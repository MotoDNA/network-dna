// 구독 관리 — 요금제 변경 · 해지 · 해지 취소
//
// 이용약관 제10조와 환불정책 제4·5조에 적어 둔 것을 그대로 구현합니다.
// 약관에만 있고 화면에는 없는 기능은 거짓말이 됩니다.
//
// ─────────────────────────────────────────────────────────────
// 돈 계산은 전부 여기서 합니다. 화면은 결과를 받아서 보여 주기만 합니다.
// 화면에서 계산하면 사용자가 그 값을 바꿔 보낼 수 있고,
// 그러면 그대로 결제 사고입니다.
// ─────────────────────────────────────────────────────────────
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mkJson } from '../_shared/cors.ts';
import { plan, planList, tierFromPlan, monthlyForApps, serviceList, vatOf } from '../_shared/catalog.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const PG_PROVIDER = Deno.env.get('PG_PROVIDER') ?? 'stub';
const PG_SECRET = Deno.env.get('PG_SECRET_KEY') ?? '';

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

/* 부른 사람이 누구인지. admin-user 의 caller() 와 같은 방식입니다. */
async function caller(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const anon = createClient(URL_, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await anon.auth.getUser();
  if (!data?.user) return null;
  const { data: prof } = await admin
    .from('profiles')
    .select('id, company_id, login_id, name, role, disabled')
    .eq('id', data.user.id)
    .single();
  if (!prof || prof.disabled) return null;
  return prof;
}

/* 남은 기간만큼만 계산합니다.
   기간의 절반이 지났으면 차액의 절반만 받습니다. */
function prorate(diff: number, periodStart: string, periodEnd: string | null): number {
  if (!periodEnd) return diff;
  const a = new Date(periodStart).getTime();
  const b = new Date(periodEnd).getTime();
  const now = Date.now();
  const total = b - a;
  const left = b - now;
  if (!(total > 0) || left <= 0) return 0;
  return Math.max(0, Math.round(diff * (left / total)));
}

/* ── 결제대행사 · 실제 청구 ────────────────────────────────
   상위 요금제로 올릴 때 차액을 즉시 받습니다.
   계약 후 이 함수만 채우면 됩니다. 시크릿 키가 필요하므로 서버에서만 부릅니다. */

/* ── 토스페이먼츠에 묻기 ──
   시크릿 키 뒤에 ':' 를 붙여 base64 → Basic 인증. 키는 환경변수에만 있습니다.
   실패하면 토스가 준 code·message 를 그대로 돌려줍니다 — 사람이 보고 판단할 수 있게. */
async function tossCall(path: string, body: Record<string, unknown>) {
  const auth = 'Basic ' + btoa(PG_SECRET + ':');
  let res: Response;
  try {
    res = await fetch('https://api.tosspayments.com' + path, {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false as const, code: 'NETWORK', message: '결제사에 닿지 못했습니다. 잠시 뒤 다시 해 주세요.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('toss', path, res.status, data?.code, data?.message);
    return { ok: false as const, code: String(data?.code ?? res.status), message: String(data?.message ?? '결제사가 거절했습니다.') };
  }
  return { ok: true as const, data };
}

/* 실제로 돈이 빠져나가는 유일한 자리입니다.
   orderId 는 우리가 만들고 **한 번만** 씁니다. 같은 값을 두 번 보내면 토스가
   거절하므로, 실수로 두 번 눌러도 두 번 결제되지 않습니다. */
/* ⚠ amount 는 **공급가액**을 넘깁니다. 부가세는 여기서 한 번만 더합니다.
      요금표가 전부 공급가액이고 화면에도 '부가세 별도'라고 적혀 있으므로,
      실제로 긁는 돈은 공급가액 + 부가세입니다. 부르는 쪽에서 미리 더하면
      두 번 붙을 수 있어, 더하는 자리를 여기 하나로 못 박습니다. */
async function pgChargeOnce(billingKey: string, customerKey: string | null, amount: number, label: string, companyId: string) {
  if (amount <= 0) return { ok: true, skipped: true };
  amount = amount + vatOf(amount);

  if (PG_PROVIDER === 'stub') {
    if (!billingKey.startsWith('stub_')) return { ok: false, message: '결제 수단을 확인하지 못했습니다.' };
    return { ok: true, stub: true };
  }
  if (!PG_SECRET) return { ok: false, message: '결제 설정이 완료되지 않았습니다.' };
  if (!customerKey) return { ok: false, message: '결제 수단에 고객 식별자가 없습니다. 카드를 다시 등록해 주세요.' };

  const orderId = 'dnalabs_' + companyId.replace(/-/g, '').slice(0, 12) + '_' + Date.now().toString(36);
  const r = await tossCall('/v1/billing/' + encodeURIComponent(billingKey), {
    customerKey, amount: Math.round(amount), orderId, orderName: label.slice(0, 100),
  });
  if (!r.ok) return { ok: false, message: r.message };
  const d = r.data as { paymentKey?: string; status?: string; approvedAt?: string };
  if (d.status !== 'DONE') return { ok: false, message: '결제가 완료되지 않았습니다 (' + (d.status ?? '?') + ').' };
  return { ok: true, paymentKey: d.paymentKey, orderId, approvedAt: d.approvedAt };
}

/* 토스 카드 발급사 코드 → 이름. signup 함수와 같은 표입니다.
   고객이 "아, 그 카드" 하고 알아보시게 하려는 것뿐이라 결제에는 안 쓰입니다. */
const 발급사: Record<string, string> = {
  '3K':'기업BC', '46':'광주', '71':'롯데', '30':'산업', '31':'BC', '51':'삼성', '38':'새마을',
  '41':'신한', '62':'신협', '36':'씨티', '33':'우리', '37':'우체국', '39':'저축', '35':'전북',
  '42':'제주', '15':'카카오뱅크', '3A':'케이뱅크', '24':'토스뱅크', '21':'하나', '61':'현대',
  '11':'국민', '91':'농협', '34':'수협',
};

/* ── 이미 쓰고 계신 회사의 카드 등록 · 바꾸기 ──

   가입 화면에서만 카드를 받았습니다. 그래서 구독 표보다 먼저 생긴 회사들
   (ACTIVA·BKT·9DORO)은 카드를 넣을 곳이 아예 없었고, 요금 걷는 일꾼을
   켜는 순간 전부 '결제 수단 없음'으로 밀릴 참이었습니다.

   화면은 토스 카드창에 다녀온 authKey 만 들고 옵니다. 빌링키는 여기서
   시크릿 키로 발급받습니다 — 브라우저는 빌링키를 끝내 보지 못합니다.
   어느 회사의 카드인지는 화면이 보낸 값이 아니라 **로그인한 사람**으로 정합니다.
   남의 회사 이름으로 카드를 걸 길이 없습니다. */
async function 카드받기(body: Record<string, unknown>) {
  if (PG_PROVIDER === 'stub') {
    const k = String(body.billingKey ?? '');
    if (!k.startsWith('stub_')) return { ok: false as const, message: '결제 수단 확인에 실패했습니다.' };
    return { ok: true as const, billingKey: k, customerKey: String(body.customerKey ?? '') || null,
             cardBrand: '테스트카드', cardLast4: '0000' };
  }
  if (!PG_SECRET) return { ok: false as const, message: '결제 설정이 완료되지 않았습니다.' };
  const authKey = String(body.authKey ?? ''), customerKey = String(body.customerKey ?? '');
  if (!authKey || !customerKey) return { ok: false as const, message: '카드 등록 결과를 받지 못했습니다. 다시 해 주세요.' };
  if (!/^[A-Za-z0-9\-_=.@]{2,50}$/.test(customerKey)) return { ok: false as const, message: '고객 식별자가 올바르지 않습니다.' };

  const r = await tossCall('/v1/billing/authorizations/issue', { authKey, customerKey });
  if (!r.ok) return { ok: false as const, message: '카드를 등록하지 못했습니다: ' + r.message };
  const d = r.data as { billingKey?: string; customerKey?: string; card?: { number?: string; issuerCode?: string } };
  if (!d.billingKey) return { ok: false as const, message: '결제사가 빌링키를 주지 않았습니다.' };

  // 토스는 43301234****123* 처럼 끝자리까지 가려서 줍니다. 가림표가 섞여도 끝 넉 자를 씁니다.
  const 번호 = String(d.card?.number ?? '');
  const code = String(d.card?.issuerCode ?? '');
  return { ok: true as const, billingKey: d.billingKey, customerKey: d.customerKey ?? customerKey,
           cardBrand: code ? (발급사[code] ?? code) : null,
           cardLast4: /\d/.test(번호.slice(-4)) ? 번호.slice(-4) : null };
}

Deno.serve(async (req) => {
  const { cors, json } = mkJson(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  const me = await caller(req);
  if (!me) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json() } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400) }
  const action = String(body.action ?? '');

  // 적용 시점이 지난 예약 변경을 먼저 처리합니다.
  // ⚠ 이것만으로는 부족합니다 — 아무도 앱을 열지 않으면 돌지 않습니다.
  //   매월 요금을 걷는 작업을 만들 때, 걷기 전에 반드시 먼저 부르세요.
  await admin.rpc('apply_due_plan_changes');

  const { data: sub } = await admin.from('subscriptions')
    .select('*').eq('company_id', me.company_id).maybeSingle();

  /* 어느 서비스를 샀는가. 화면이 아니라 이 값이 문을 엽니다 —
     company_for_app(app) 이 데이터베이스 정책마다 들어 있습니다. */
  const { data: 회사 } = await admin.from('companies')
    .select('apps').eq('id', me.company_id).maybeSingle();

  /* 등록된 카드와 밀린 결제. 읽기만 하므로 직원도 봅니다.
     ⚠ 빌링키는 절대 내보내지 않습니다 — 카드사 이름과 끝 넉 자만. */
  const { data: 카드 } = await admin.from('billing_methods')
    .select('card_brand, card_last4, updated_at').eq('company_id', me.company_id).maybeSingle();
  const 카드정보 = 카드 ? { brand: 카드.card_brand, last4: 카드.card_last4, since: 카드.updated_at } : null;
  const { data: 밀린것 } = await admin.from('billing_charges')
    .select('amount, due_on, tries, last_error').eq('company_id', me.company_id).eq('status', 'failed')
    .order('due_on', { ascending: false }).limit(1).maybeSingle();
  const 밀림 = 밀린것 ? { amount: 밀린것.amount, dueOn: 밀린것.due_on, tries: 밀린것.tries, reason: 밀린것.last_error } : null;
  const 관리자 = me.role === 'admin';

  /* 구독 표가 생기기 전에 만들어진 회사들이 있습니다(ACTIVA·BKT·9DORO…).
     쓰고는 계신데 요금제가 붙어 있지 않습니다.

     읽기만 하는 'services' 는 그래도 답해 줍니다 — 자기가 무엇을 쓰고
     있는지는 보셔야 합니다. 화면에 "불러오지 못했습니다" 만 띄우고
     막다른 길로 두면 안 됩니다.

     돈이 오가는 일(더하기·빼기·요금제 변경)은 요금제가 붙어야 합니다.
     얼마를 받을지 모르는 채로 카드를 긁을 수는 없습니다. */
  if (!sub) {
    if (action === 'services') {
      const 가진 = Array.isArray(회사?.apps) ? (회사!.apps as string[]) : [];
      return json({
        ok: true, noSub: true,
        services: serviceList().map((v: { key: string; name: string; note?: string }) => ({
          key: v.key, name: v.name, note: v.note ?? null,
          owned: 가진.includes(v.key), addNow: null, removeScheduled: false,
        })),
        count: 가진.length,
        monthly: null, monthlyPaid: null,
        monthlyIfAdd: null, monthlyIfAddPaid: null,
        monthlyIfRemove: null, monthlyIfRemovePaid: null,
        status: null, periodEnd: null, trialing: false,
        card: 카드정보, owed: null, isAdmin: 관리자,
      });
    }
    return json({ ok: false, error: '이 회사에는 아직 요금제가 연결돼 있지 않습니다. 010-6451-5807 로 알려 주시면 연결해 드립니다.' }, 404);
  }

  const { count: usedCount } = await admin.from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', me.company_id).eq('disabled', false);
  const used = usedCount ?? 0;

  /* ── 고를 수 있는 요금제와 각각의 금액 ──
     읽기만 하므로 직원도 볼 수 있습니다. 바꾸는 것은 관리자만입니다. */
  /* 이 회사가 쓰는 서비스 개수. 요금은 인원 구간 × 서비스 개수입니다.
     plans 에 적힌 price 는 '서비스 하나'일 때의 값이라 그대로 쓰면 안 됩니다. */
  const 가진것: string[] = Array.isArray(회사?.apps) ? (회사!.apps as string[]) : [];
  const 개수 = Math.max(1, 가진것.length || Number(sub.services) || 1);

  /* 요금은 '어느 구간인가' × '무엇을 쓰는가' 로 정해집니다.
     서비스마다 값이 달라서 개수만으로는 셀 수 없습니다. */
  const 값 = (planKey: string, 목록?: string[]) =>
    monthlyForApps(tierFromPlan(planKey)?.key ?? null, planKey, 목록 ?? 가진것);
  const 지금구간 = (sub.tier_key as string | null) ?? tierFromPlan(sub.plan_key)?.key ?? null;
  const 값2 = (목록: string[]) => monthlyForApps(지금구간, sub.plan_key, 목록);

  if (action === 'plans') {
    const curPrice = Number(값2(가진것) ?? sub.price ?? 0);

    const list = planList().map((p: any) => {
      const isCurrent = p.key === sub.plan_key;
      const fits = p.seatMax === null || used <= p.seatMax;
      const quote = p.per === 'quote';
      const 월 = Number(값(p.key) ?? 0);      // 이 회사의 서비스 개수로 매긴 값

      let direction: 'up' | 'down' | 'same' = 'same';
      if (!quote && 월 > curPrice) direction = 'up';
      if (!quote && 월 < curPrice) direction = 'down';

      // 무료 체험 중에 무료 기간이 없는 요금제로 옮기면 체험이 끝납니다
      const endsTrial = sub.status === 'trialing' && !quote && !p.trialDays;

      let amountNow = 0;
      if (!quote && !isCurrent) {
        const 공급 = endsTrial
          ? 월                                             // 체험 종료 → 새 기간 전액
          : direction === 'up'
            ? prorate(월 - curPrice, sub.period_start, sub.period_end)
            : 0;                                           // 하위는 지금 받지 않습니다
        // 화면이 말하는 금액은 **실제로 긁히는 금액**이어야 합니다. 말과 카드가 다르면 안 됩니다.
        amountNow = 공급 > 0 ? 공급 + vatOf(공급) : 0;
      }

      let reason: string | null = null;
      if (quote) reason = '50명 이상은 따로 문의해 주세요.';
      else if (isCurrent) reason = '지금 쓰고 계신 요금제입니다.';
      else if (!fits) reason = `직원이 ${used}명이라 이 요금제(${p.seatMax}명)로는 내릴 수 없습니다.`;

      return {
        key: p.key, name: p.name, label: p.label, price: 월,
        seatMin: p.seatMin, seatMax: p.seatMax, tagline: p.tagline,
        isCurrent, direction, endsTrial,
        allowed: !quote && !isCurrent && fits && sub.status !== 'canceled',
        reason,
        amountNow,
        effective: direction === 'down' && !endsTrial ? 'period_end' : 'now',
      };
    });

    return json({
      ok: true, used,
      status: sub.status,
      current: sub.plan_key,
      currentName: sub.plan_name,
      currentPrice: curPrice,
      currentPricePaid: curPrice + vatOf(curPrice),
      services: 개수,
      periodEnd: sub.period_end,
      pending: sub.pending_plan_key
        ? { key: sub.pending_plan_key, name: sub.pending_plan_name,
            price: sub.pending_price, from: sub.pending_from }
        : null,
      plans: list,
    });
  }

  if (action === 'services') {
    const 지금값 = Number(값2(가진것) ?? 0);

    return json({
      ok: true,
      services: serviceList().map((v: { key: string; name: string; note?: string }) => {
        const 가짐 = 가진것.includes(v.key);
        const 뺄예약 = Array.isArray(sub.pending_apps) && !sub.pending_apps.includes(v.key) && 가짐;

        /* 이 하나를 더하면(또는 빼면) 월 얼마가 되는가. 조합마다 다르므로
           개수를 세지 않고 **실제 목록**으로 셉니다. */
        const 더하면 = 가짐 ? null : 값2([...가진것, v.key]);
        const 빼면   = 가짐 && 가진것.length > 1 ? 값2(가진것.filter((a) => a !== v.key)) : null;

        const 더할공급 = (가짐 || sub.status === 'trialing' || 더하면 === null)
          ? 0 : prorate(Number(더하면) - 지금값, sub.period_start, sub.period_end);

        return {
          key: v.key, name: v.name, note: v.note ?? null,
          owned: 가짐,
          // 더하면 이번 달에 지금 내실 돈 (부가세 포함 — 실제로 긁히는 금액)
          addNow: 가짐 ? null : (더할공급 > 0 ? 더할공급 + vatOf(더할공급) : 0),
          // 이 서비스를 더했을 때 / 뺐을 때의 월 요금
          monthlyIf: 더하면 === null ? null : Number(더하면),
          monthlyIfPaid: 더하면 === null ? null : Number(더하면) + vatOf(Number(더하면)),
          monthlyIfRemoveThis: 빼면 === null ? null : Number(빼면),
          monthlyIfRemoveThisPaid: 빼면 === null ? null : Number(빼면) + vatOf(Number(빼면)),
          // 이 구간에서는 팔지 않는 서비스 (Re:Store 는 1명 줄이 없습니다)
          unavailable: !가짐 && 더하면 === null,
          removeScheduled: 뺄예약,
        };
      }),
      count: 개수, monthly: 지금값, monthlyPaid: 지금값 + vatOf(지금값),
      status: sub.status,
      periodEnd: sub.period_end,
      trialing: sub.status === 'trialing',
      card: 카드정보, owed: 밀림, isAdmin: 관리자,
    });
  }

  // ── 아래는 모두 관리자만 ──
  // 돈이 걸린 일이라 직원이 회사 요금제를 바꾸거나 해지하면 안 됩니다.
  if (me.role !== 'admin') {
    return json({ ok: false, error: '구독은 회사 관리자만 바꿀 수 있습니다.' }, 403);
  }

  /* ── 카드 등록 · 바꾸기 ──
     카드는 회사에 하나입니다(billing_methods 의 열쇠가 company_id).
     바꾸면 옛 빌링키는 덮어써져 다시 쓰이지 않습니다. */
  if (action === 'card_register') {
    const c = await 카드받기(body);
    if (!c.ok) return json({ ok: false, error: c.message }, 400);

    const { error: e1 } = await admin.from('billing_methods').upsert({
      company_id: me.company_id, provider: PG_PROVIDER,
      billing_key: c.billingKey, customer_key: c.customerKey,
      card_brand: c.cardBrand, card_last4: c.cardLast4,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (e1) {
      console.error('[카드] 저장 실패', me.company_id, e1.code, e1.message);
      return json({ ok: false, error: '카드는 확인됐는데 저장하지 못했습니다. 010-6451-5807 로 알려 주세요.' }, 500);
    }

    /* 밀린 결제가 있으면 다음 차례(매일 새벽 4시)에 새 카드로 다시 해 봅니다.
       재시도 한도를 이미 다 쓴 경우에도 한 번은 더 하게 둡니다 — 카드를 바꾼 것은
       '다시 해 달라'는 뜻입니다. 여기서 바로 긁지 않는 것은, 걷는 셈을
       일꾼 한 곳에만 두어야 두 번 긁히는 일이 없기 때문입니다. */
    const { data: 실패들 } = await admin.from('billing_charges')
      .select('id, tries').eq('company_id', me.company_id).eq('status', 'failed');
    for (const f of 실패들 ?? []) {
      await admin.from('billing_charges').update({
        next_try_at: new Date().toISOString(),
        tries: Math.min(Number(f.tries ?? 0), 3),
      }).eq('id', f.id);
    }

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 카드 ? 'card_replaced' : 'card_registered', target: 'card',
      detail: { brand: c.cardBrand, last4: c.cardLast4 },     // 빌링키는 기록에도 남기지 않습니다
    });

    return json({ ok: true, card: { brand: c.cardBrand, last4: c.cardLast4 },
                  retry: (실패들 ?? []).length > 0 });
  }

  /* ── 요금제 변경 ── */
  if (action === 'change') {
    const target = plan(String(body.planKey ?? ''));
    if (!target) return json({ ok: false, error: '요금제를 다시 골라 주세요.' }, 400);
    if (target.per === 'quote') return json({ ok: false, error: '50명 이상은 따로 문의해 주세요.' }, 400);
    if (target.key === sub.plan_key) return json({ ok: false, error: '지금 쓰고 계신 요금제입니다.' }, 409);
    if (sub.status === 'canceled') {
      return json({ ok: false, error: '해지 신청 중에는 바꿀 수 없습니다. 먼저 해지를 취소해 주세요.' }, 409);
    }
    if (target.seatMax !== null && used > target.seatMax) {
      return json({
        ok: false,
        error: `직원이 ${used}명이라 ${target.name}(${target.seatMax}명)로는 내릴 수 없습니다. 쓰지 않는 계정을 먼저 정지해 주세요.`,
      }, 409);
    }

    const curPrice = Number(값2(가진것) ?? sub.price ?? 0);
    const 새값 = Number(값(target.key) ?? 0);
    if (!새값) return json({ ok: false, error: '요금을 셀 수 없는 요금제입니다. 문의해 주세요.' }, 400);
    const endsTrial = sub.status === 'trialing' && !target.trialDays;
    const isUp = 새값 > curPrice;
    const now = new Date();

    /* 하위 요금제 — 지금 받는 것도 돌려주는 것도 없습니다.
       다음 결제일에 바뀝니다 (환불정책 제5조). */
    if (!isUp && !endsTrial) {
      const { error } = await admin.from('subscriptions').update({
        pending_plan_key: target.key,
        pending_plan_name: target.name,
        pending_price: 새값,
        pending_seat_limit: target.seatMax,
        pending_from: sub.period_end,
      }).eq('company_id', me.company_id);
      if (error) return json({ ok: false, error: '예약하지 못했습니다.' }, 500);

      await admin.from('audit_log').insert({
        company_id: me.company_id, actor_id: me.id,
        action: 'plan_change_scheduled', target: target.key,
        detail: { from: sub.plan_key, at: sub.period_end },
      });
      return json({ ok: true, mode: 'scheduled', from: sub.period_end, name: target.name });
    }

    /* 상위 요금제 — 즉시 바꾸고 남은 기간만큼의 차액을 받습니다.
       체험 중에 유료 요금제로 옮기는 경우에는 체험이 끝나고 전액을 받습니다. */
    const amount = endsTrial
      ? 새값
      : prorate(새값 - curPrice, sub.period_start, sub.period_end);

    const { data: bm } = await admin.from('billing_methods')
      .select('billing_key, customer_key').eq('company_id', me.company_id).maybeSingle();
    if (!bm?.billing_key) return json({ ok: false, error: '등록된 결제 수단이 없습니다.' }, 402);

    const pay = await pgChargeOnce(bm.billing_key, bm.customer_key, amount, `Re:Call ${target.name}`, me.company_id);
    if (!pay.ok) return json({ ok: false, error: pay.message ?? '결제하지 못했습니다.' }, 402);

    const patch: Record<string, unknown> = {
      plan_key: target.key,
      plan_name: target.name,
      tier_key: tierFromPlan(target.key)?.key ?? null,
      price: 새값,
      seat_limit: target.seatMax,
      // 내려가기로 예약해 둔 것이 있으면 지웁니다. 올리기로 마음을 바꾸신 것입니다.
      pending_plan_key: null, pending_plan_name: null,
      pending_price: null, pending_seat_limit: null, pending_from: null,
    };
    if (endsTrial) {
      // 체험이 끝나고 새 결제 기간이 오늘부터 시작합니다
      patch.status = 'active';
      patch.trial_ends_at = null;
      patch.period_start = now.toISOString();
      patch.period_end = new Date(new Date(now).setMonth(now.getMonth() + 1)).toISOString();
    }

    const { error } = await admin.from('subscriptions').update(patch).eq('company_id', me.company_id);
    if (error) return json({ ok: false, error: '변경하지 못했습니다.' }, 500);

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 'plan_change_applied', target: target.key,
      detail: { from: sub.plan_key, supply: amount, vat: vatOf(amount),
                charged: amount > 0 ? amount + vatOf(amount) : 0, endsTrial, pg: PG_PROVIDER },
    });
    return json({ ok: true, mode: 'now', charged: amount > 0 ? amount + vatOf(amount) : 0,
                  name: target.name, endsTrial });
  }

  /* ═══════ 서비스 더하기 · 빼기 ═══════

     요금은 인원 구간 × 서비스 개수입니다. 그래서 서비스를 하나 더하는 것은
     요금제를 한 칸 올리는 것과 셈이 같습니다. 규칙도 같게 둡니다 —
     환불정책 제5조 그대로입니다.

       더할 때 — 지금 바로 쓰십니다. 이번 달 남은 날짜만큼만 차액을 받습니다
       뺄 때   — 다음 결제일에 빠집니다. 이미 낸 돈은 돌려드리지 않고,
                 그날까지는 그대로 쓰십니다

     무료 체험 중에는 더해도 받지 않습니다. 아직 한 푼도 안 내신 분께
     추가분만 따로 받는 것은 말이 안 됩니다. 무료가 끝나면 늘어난
     개수로 걷힙니다. */

  if (action === 'service_add') {
    const 고른것 = String(body.app ?? '');
    const 있는가 = serviceList().some((v: { key: string }) => v.key === 고른것);
    if (!있는가) return json({ ok: false, error: '그런 서비스가 없습니다.' }, 400);
    if (가진것.includes(고른것)) return json({ ok: false, error: '이미 쓰고 계신 서비스입니다.' }, 409);
    if (sub.status === 'canceled') {
      return json({ ok: false, error: '해지 신청 중에는 더할 수 없습니다. 먼저 해지를 취소해 주세요.' }, 409);
    }
    if (개수 >= 4) return json({ ok: false, error: '네 가지를 모두 쓰고 계십니다.' }, 409);

    const 새목록 = [...가진것, 고른것];
    const 새개수 = 새목록.length;
    const 지금값 = Number(값2(가진것) ?? 0);
    const 센것 = 값2(새목록);
    if (센것 === null) {
      /* 그 구간에서는 팔지 않는 조합입니다. Re:Store 는 1명 줄이 없습니다 —
         점포가 있으면 이미 혼자가 아니기 때문입니다. 무엇을 하시면 되는지 말씀드립니다. */
      return json({
        ok: false,
        error: 고른것 === 'restore'
          ? 'Re:Store 는 1명 요금제에서는 쓰실 수 없습니다. 요금제를 5명까지로 올리신 뒤 더해 주세요.'
          : '지금 요금제에서는 이 서비스를 더할 수 없습니다. 문의해 주세요.',
      }, 409);
    }
    const 새달값 = Number(센것);

    /* 체험 중에는 받지 않습니다. 그 밖에는 이번 달 남은 날짜만큼만. */
    const amount = sub.status === 'trialing'
      ? 0
      : prorate(새달값 - 지금값, sub.period_start, sub.period_end);

    if (amount > 0) {
      const { data: bm } = await admin.from('billing_methods')
        .select('billing_key, customer_key').eq('company_id', me.company_id).maybeSingle();
      if (!bm?.billing_key) return json({ ok: false, error: '등록된 결제 수단이 없습니다.' }, 402);

      const pay = await pgChargeOnce(bm.billing_key, bm.customer_key, amount,
        `Re:Service ${고른것} 추가`, me.company_id);
      if (!pay.ok) return json({ ok: false, error: pay.message ?? '결제하지 못했습니다.' }, 402);
    }

    /* 돈을 받은 뒤에 엽니다. 순서가 바뀌면 결제가 막혔는데 서비스는 열린 상태가 됩니다.
       apps 가 실제로 문을 여는 값입니다 — 화면이 아니라 이 값이 정합니다. */
    const { error: eA } = await admin.from('companies')
      .update({ apps: [...가진것, 고른것] }).eq('id', me.company_id);
    if (eA) return json({ ok: false, error: '서비스를 열지 못했습니다. 결제는 되었으니 연락 주세요.' }, 500);

    await admin.from('subscriptions').update({
      services: 새개수, price: 새달값,
      // 빼기로 예약해 둔 것이 있으면 지웁니다. 마음을 바꾸신 것입니다.
      pending_services: null, pending_apps: null,
      pending_from: sub.pending_plan_key ? sub.pending_from : null,
    }).eq('company_id', me.company_id);

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 'service_added', target: 고른것,
      detail: { from: 개수, to: 새개수,
                supply: amount, vat: vatOf(amount), charged: amount > 0 ? amount + vatOf(amount) : 0,
                monthly: 새달값, pg: PG_PROVIDER },
    });
    return json({ ok: true, charged: amount > 0 ? amount + vatOf(amount) : 0,
                  services: 새개수, monthly: 새달값, monthlyPaid: 새달값 + vatOf(새달값) });
  }

  if (action === 'service_remove') {
    const 고른것 = String(body.app ?? '');
    if (!가진것.includes(고른것)) return json({ ok: false, error: '쓰고 계시지 않은 서비스입니다.' }, 409);
    if (가진것.length <= 1) {
      return json({ ok: false, error: '마지막 하나는 뺄 수 없습니다. 그만 쓰시려면 해지해 주세요.' }, 409);
    }

    const 남는것 = 가진것.filter((a) => a !== 고른것);
    const 새개수 = 남는것.length;
    const 새달값 = Number(값2(남는것) ?? 0);

    /* 지금 끊지 않습니다. 이미 이번 달 요금을 받았으므로 그날까지는 쓰십니다.
       돌려드리는 것은 없습니다 (환불정책 제5조). */
    const { error } = await admin.from('subscriptions').update({
      pending_apps: 남는것,
      pending_services: 새개수,
      pending_price: 새달값,
      pending_from: sub.period_end,
    }).eq('company_id', me.company_id);
    if (error) return json({ ok: false, error: '예약하지 못했습니다.' }, 500);

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 'service_remove_scheduled', target: 고른것,
      detail: { at: sub.period_end, to: 새개수, monthly: 새달값 },
    });
    return json({ ok: true, from: sub.period_end, services: 새개수, monthly: 새달값 });
  }

  /* ── 예약해 둔 변경 취소 ── */
  if (action === 'cancel_change') {
    if (!sub.pending_plan_key && !sub.pending_apps) {
      return json({ ok: false, error: '예약된 변경이 없습니다.' }, 409);
    }
    const { error } = await admin.from('subscriptions').update({
      pending_plan_key: null, pending_plan_name: null, pending_tier_key: null,
      pending_price: null, pending_seat_limit: null,
      pending_services: null, pending_apps: null, pending_from: null,
    }).eq('company_id', me.company_id);
    if (error) return json({ ok: false, error: '되돌리지 못했습니다.' }, 500);

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 'plan_change_canceled', target: sub.pending_plan_key, detail: {},
    });
    return json({ ok: true });
  }

  /* ── 해지 ── */
  if (action === 'cancel') {
    if (sub.status === 'canceled') {
      return json({ ok: false, error: '이미 해지 신청된 구독입니다.' }, 409);
    }
    const { error } = await admin.from('subscriptions').update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    }).eq('company_id', me.company_id);
    if (error) return json({ ok: false, error: '해지 처리에 실패했습니다.' }, 500);

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 'subscription_cancel', target: sub.plan_key,
      detail: { until: sub.period_end, was: sub.status },
    });
    return json({ ok: true, status: 'canceled', until: sub.period_end });
  }

  /* ── 해지 취소 ── */
  if (action === 'resume') {
    if (sub.status !== 'canceled') {
      return json({ ok: false, error: '해지 신청된 구독이 아닙니다.' }, 409);
    }
    // 이미 기간이 끝나 버렸으면 되살리지 않습니다.
    // 결제를 새로 받아야 하므로 다시 가입하셔야 합니다.
    if (sub.period_end && new Date(sub.period_end) < new Date()) {
      return json({ ok: false, error: '이용 기간이 이미 끝났습니다. 다시 가입해 주세요.' }, 409);
    }
    const back = sub.trial_ends_at && new Date(sub.trial_ends_at) > new Date()
      ? 'trialing' : 'active';
    const { error } = await admin.from('subscriptions').update({
      status: back, canceled_at: null,
    }).eq('company_id', me.company_id);
    if (error) return json({ ok: false, error: '되돌리지 못했습니다.' }, 500);

    await admin.from('audit_log').insert({
      company_id: me.company_id, actor_id: me.id,
      action: 'subscription_resume', target: sub.plan_key, detail: { to: back },
    });
    return json({ ok: true, status: back });
  }

  return json({ ok: false, error: '알 수 없는 요청입니다.' }, 400);
});
