/* ═══════════════════════════════════════════════════════════
   catalog.json 을 읽고 다루는 공용 함수.

   요금제 숫자와 업종 판정을 화면에 직접 적지 않습니다.
   홈페이지·가입 화면·서버가 모두 같은 파일을 봐야
   "화면에는 49,000원인데 실제로는 99,000원이 빠져나가는" 일이 안 생깁니다.

   서버(supabase/functions/_shared/catalog.ts)도 같은 규칙을 씁니다.
   그쪽은 sync-catalog.sh 가 이 저장소의 catalog.json 에서 만들어 냅니다.
   ═══════════════════════════════════════════════════════════ */

const Catalog = (() => {
  let cache = null;

  async function load(){
    if (cache) return cache;
    const res = await fetch('catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('catalog.json 을 불러오지 못했습니다 (' + res.status + ')');
    cache = await res.json();
    return cache;
  }

  /* 표시 순서대로. '_' 로 시작하는 설명 항목은 걸러냅니다. */
  function planList(c){
    return Object.entries(c.plans)
      .filter(([k]) => k !== '_')
      .map(([key, p]) => ({ key, ...p }));
  }

  function plan(c, key){
    const p = c.plans[key];
    return (!p || key === '_') ? null : { key, ...p };
  }

  /* 인원 수에 맞는 요금제. 경계는 seatMin/seatMax 포함입니다.
     personal 은 1인 전용이라 여기서 제외합니다 — 1명이어도
     회사로 가입하면 Business 5 가 맞습니다. */
  function planForSeats(c, seats){
    const n = Number(seats);
    if (!Number.isInteger(n) || n < 1) return null;
    return planList(c).find(p =>
      p.key !== 'personal' &&
      n >= p.seatMin &&
      (p.seatMax === null || n <= p.seatMax)
    ) || null;
  }

  /* 그 요금제로 이 인원이 되는가 */
  function seatsFit(p, seats){
    const n = Number(seats);
    if (!p || !Number.isInteger(n)) return false;
    return n >= p.seatMin && (p.seatMax === null || n <= p.seatMax);
  }

  /* ───── 통합 요금 (services × tiers) ─────
     서비스마다 값이 다르지 않습니다. 인원 구간을 고르고, 고른 서비스 개수만큼
     addon 이 붙습니다. 요금표·가입 화면·서버가 모두 이 셈을 씁니다 —
     한 군데서만 고치면 화면과 청구가 어긋납니다. */
  function serviceList(c){
    return Object.entries(c.services || {})
      .filter(([k]) => k !== '_')
      .map(([key, s]) => ({ key, ...s }));
  }

  function storeTierList(c){
    return Object.entries(c.storeTiers || {})
      .filter(([k]) => k !== '_')
      .map(([key, t]) => ({ key, ...t }));
  }

  /* 점포 수에 맞는 구간 (Re:Store 전용) */
  function storeTierFor(c, stores){
    const n = Number(stores);
    if (!Number.isInteger(n) || n < 1) return null;
    return storeTierList(c).find(t =>
      n >= t.storeMin && (t.storeMax === null || n <= t.storeMax)
    ) || null;
  }

  function tierList(c){
    return Object.entries(c.tiers || {})
      .filter(([k]) => k !== '_')
      .map(([key, t]) => ({ key, ...t }));
  }

  /* 인원 수에 맞는 구간. 구간끼리 겹치지 않으므로 처음 맞는 것이 답입니다. */
  function tierForSeats(c, seats){
    const n = Number(seats);
    if (!Number.isInteger(n) || n < 1) return null;
    return tierList(c).find(t =>
      n >= t.seatMin && (t.seatMax === null || n <= t.seatMax)
    ) || null;
  }

  /* 그 구간에서 서비스 count 개를 쓸 때의 월 요금. 협의 구간은 null 입니다. */
  function priceFor(t, count){
    if (!t || t.base === null) return null;
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1) return null;
    return t.base + t.addon * (n - 1);
  }

  /* 그 구간이 사다리의 몇 층인가. 인원 구간과 점포 구간이 같은 층을 씁니다. */
  function levelOf(t){ return t ? (t.level || null) : null }

  /* 서비스 하나의 그 층 단가. 없으면 null (Re:Store 의 1명 줄). */
  function rateOf(c, key, level){
    const p = ((c.services || {})[key] || {}).price || {};
    return p[level] || null;
  }

  /* ───── 한 회사가 한 달에 낼 돈 ─────
     ⚠ 서버(_shared/catalog.ts)의 monthlyForApps 와 **같은 셈**이어야 합니다.
       화면이 말한 금액과 실제로 긁힌 금액이 다르면 그게 제일 나쁩니다.

     기본료는 하나만 붙고 나머지는 추가 단가로 붙습니다. 어느 것을 기본료로
     잡느냐로 금액이 달라지므로 **가장 싸지는 쪽**을 우리가 골라 줍니다. */
  function monthlyForApps(c, tierKeyOrTier, apps){
    const t = typeof tierKeyOrTier === 'string'
      ? (tierList(c).find(x => x.key === tierKeyOrTier) || storeTierList(c).find(x => x.key === tierKeyOrTier) || null)
      : tierKeyOrTier;
    const lv = levelOf(t);
    if (!lv || lv === 'ent') return null;

    const 목록 = (apps || []).filter((a, i, arr) => a && arr.indexOf(a) === i);
    if (!목록.length) return null;

    let 합 = 0, 작은차 = null;
    for (const a of 목록) {
      const r = rateOf(c, a, lv);
      if (!r) return null;
      합 += r.addon;
      const 차 = r.base - r.addon;
      if (작은차 === null || 차 < 작은차) 작은차 = 차;
    }
    const 값 = 합 + (작은차 || 0);
    const 상한 = Number((c.maxSupply || {}).amount || 0);
    return 상한 > 0 ? Math.min(값, 상한) : 값;
  }

  /* ───── 부가가치세 ─────
     이 요금표의 금액은 전부 **공급가액**입니다. 카드에서 실제로 빠져나가는
     돈은 공급가액 + 부가세입니다.

     ⚠ 서버(_shared/catalog.ts)의 같은 이름 함수와 **같은 셈**이어야 합니다.
       화면이 말한 금액과 실제로 긁힌 금액이 다르면 그게 제일 나쁩니다. */
  function vatOf(c, supply){
    const r = Number((c && c.tax && c.tax.vatRate) != null ? c.tax.vatRate : 0.1);
    return Math.round((Number(supply) || 0) * r);
  }
  function withVat(c, supply){
    const n = Number(supply) || 0;
    return n + vatOf(c, n);
  }

  /* 업종 id → 'A' | 'B' | 'C' | null */
  function gradeOf(c, id){
    for (const g of ['A','B','C']) {
      if (c.industries[g].some(i => i.id === id)) return g;
    }
    return null;
  }

  function industry(c, id){
    for (const g of ['A','B','C']) {
      const hit = c.industries[g].find(i => i.id === id);
      if (hit) return { grade: g, ...hit };
    }
    return null;
  }

  /* 화면에 뿌릴 업종 목록 — 고르는 순서는 A → B → C 입니다.
     불가 업종을 목록에서 빼지 않는 것은 의도한 것입니다.
     고른 뒤에 왜 안 되는지 근거를 보여 주는 편이,
     없는 업종을 찾다 아무거나 고르게 두는 것보다 낫습니다. */
  function allIndustries(c){
    return ['A','B','C'].flatMap(g => c.industries[g].map(i => ({ grade: g, ...i })));
  }

  return { load, planList, plan, planForSeats, seatsFit,
           serviceList, tierList, tierForSeats, priceFor, vatOf, withVat,
           levelOf, rateOf, monthlyForApps,
           storeTierList, storeTierFor,
           gradeOf, industry, allIndustries };
})();

if (typeof module !== 'undefined') module.exports = Catalog;
