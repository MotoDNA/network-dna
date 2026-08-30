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

  return { load, planList, plan, planForSeats, seatsFit, gradeOf, industry, allIndustries };
})();

if (typeof module !== 'undefined') module.exports = Catalog;
