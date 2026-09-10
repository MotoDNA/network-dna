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
import { plan, planList } from '../_shared/catalog.ts';

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
async function pgChargeOnce(billingKey: string, customerKey: string | null, amount: number, label: string, companyId: string) {
  if (amount <= 0) return { ok: true, skipped: true };

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
  if (!sub) return json({ ok: false, error: '구독 정보가 없습니다.' }, 404);

  const { count: usedCount } = await admin.from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', me.company_id).eq('disabled', false);
  const used = usedCount ?? 0;

  /* ── 고를 수 있는 요금제와 각각의 금액 ──
     읽기만 하므로 직원도 볼 수 있습니다. 바꾸는 것은 관리자만입니다. */
  if (action === 'plans') {
    const cur = plan(sub.plan_key);
    const curPrice = Number(sub.price ?? cur?.price ?? 0);

    const list = planList().map((p: any) => {
      const isCurrent = p.key === sub.plan_key;
      const fits = p.seatMax === null || used <= p.seatMax;
      const quote = p.per === 'quote';

      let direction: 'up' | 'down' | 'same' = 'same';
      if (!quote && p.price > curPrice) direction = 'up';
      if (!quote && p.price < curPrice) direction = 'down';

      // 무료 체험 중에 무료 기간이 없는 요금제로 옮기면 체험이 끝납니다
      const endsTrial = sub.status === 'trialing' && !quote && !p.trialDays;

      let amountNow = 0;
      if (!quote && !isCurrent) {
        amountNow = endsTrial
          ? p.price                                        // 체험 종료 → 새 기간 전액
          : direction === 'up'
            ? prorate(p.price - curPrice, sub.period_start, sub.period_end)
            : 0;                                           // 하위는 지금 받지 않습니다
      }

      let reason: string | null = null;
      if (quote) reason = '50명 이상은 따로 문의해 주세요.';
      else if (isCurrent) reason = '지금 쓰고 계신 요금제입니다.';
      else if (!fits) reason = `직원이 ${used}명이라 이 요금제(${p.seatMax}명)로는 내릴 수 없습니다.`;

      return {
        key: p.key, name: p.name, label: p.label, price: p.price,
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
      periodEnd: sub.period_end,
      pending: sub.pending_plan_key
        ? { key: sub.pending_plan_key, name: sub.pending_plan_name,
            price: sub.pending_price, from: sub.pending_from }
        : null,
      plans: list,
    });
  }

  // ── 아래는 모두 관리자만 ──
  // 돈이 걸린 일이라 직원이 회사 요금제를 바꾸거나 해지하면 안 됩니다.
  if (me.role !== 'admin') {
    return json({ ok: false, error: '구독은 회사 관리자만 바꿀 수 있습니다.' }, 403);
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

    const curPrice = Number(sub.price ?? 0);
    const endsTrial = sub.status === 'trialing' && !target.trialDays;
    const isUp = target.price > curPrice;
    const now = new Date();

    /* 하위 요금제 — 지금 받는 것도 돌려주는 것도 없습니다.
       다음 결제일에 바뀝니다 (환불정책 제5조). */
    if (!isUp && !endsTrial) {
      const { error } = await admin.from('subscriptions').update({
        pending_plan_key: target.key,
        pending_plan_name: target.name,
        pending_price: target.price,
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
      ? target.price
      : prorate(target.price - curPrice, sub.period_start, sub.period_end);

    const { data: bm } = await admin.from('billing_methods')
      .select('billing_key, customer_key').eq('company_id', me.company_id).maybeSingle();
    if (!bm?.billing_key) return json({ ok: false, error: '등록된 결제 수단이 없습니다.' }, 402);

    const pay = await pgChargeOnce(bm.billing_key, bm.customer_key, amount, `Re:Call ${target.name}`, me.company_id);
    if (!pay.ok) return json({ ok: false, error: pay.message ?? '결제하지 못했습니다.' }, 402);

    const patch: Record<string, unknown> = {
      plan_key: target.key,
      plan_name: target.name,
      price: target.price,
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
      detail: { from: sub.plan_key, amount, endsTrial, pg: PG_PROVIDER },
    });
    return json({ ok: true, mode: 'now', charged: amount, name: target.name, endsTrial });
  }

  /* ── 예약해 둔 변경 취소 ── */
  if (action === 'cancel_change') {
    if (!sub.pending_plan_key) return json({ ok: false, error: '예약된 변경이 없습니다.' }, 409);
    const { error } = await admin.from('subscriptions').update({
      pending_plan_key: null, pending_plan_name: null,
      pending_price: null, pending_seat_limit: null, pending_from: null,
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
