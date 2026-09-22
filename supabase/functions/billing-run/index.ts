// 매달 요금을 걷는 일꾼
//
// ─────────────────────────────────────────────────────────────
// 토스는 정기결제를 대신 돌려 주지 않습니다. 문서에 못 박혀 있습니다 —
// "스케줄링 기능은 직접 구현해야 합니다." 빌링키를 주고 "때 되면 이 키로
// 긁으세요" 할 뿐입니다. 그 '때 되면 긁는' 것이 이 파일입니다.
//
// 돈이 자동으로 빠져나가는 코드입니다. 한 번 잘못 돌면 남의 카드에서
// 엉뚱한 금액이 나갑니다. 그래서 이렇게 짰습니다.
//
//   1. 기본은 연습 모드입니다. BILLING_LIVE=1 을 켜야 실제로 긁습니다.
//      그 전까지는 "긁을 뻔한 목록"만 billing_charges 에 적어 둡니다.
//   2. 같은 기간을 두 번 걷지 않습니다. (company_id, due_on) 이 열쇠라
//      데이터베이스가 막습니다. 일꾼이 두 번 돌든 두 대가 겹쳐 돌든 한 번입니다.
//   3. 한 번에 걷는 건수에 상한이 있습니다 (MAX_PER_RUN, 기본 50).
//      무언가 잘못되면 쉰 건에서 멈춥니다.
//   4. 아무나 부를 수 없습니다. x-billing-secret 이 맞아야 합니다.
//      BILLING_SECRET 이 비어 있으면 아예 안 돕니다 — 실수로 열어 두지 않도록.
//   5. 카드가 거절하면 사흘 뒤 다시 합니다. 네 번까지만 하고 멈춥니다.
//      끝없이 긁으면 카드사가 우리를 사기로 봅니다.
// ─────────────────────────────────────────────────────────────
//
// 부르는 법
//   curl -X POST .../functions/v1/billing-run -H "x-billing-secret: <값>"
//   ?dry=1 을 붙이면 BILLING_LIVE 가 켜져 있어도 연습만 합니다.
//
// ⚠ 지금은 subscriptions.price 를 그대로 걷습니다. 그 값은 '서비스 1개' 기준입니다.
//   서비스 개수에 따른 요금(tiers)은 다음 단계에서 붙입니다.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PG_PROVIDER = Deno.env.get('PG_PROVIDER') ?? 'stub';
const PG_SECRET = Deno.env.get('PG_SECRET_KEY') ?? '';
const SECRET = Deno.env.get('BILLING_SECRET') ?? '';
const LIVE = (Deno.env.get('BILLING_LIVE') ?? '0') === '1';
const MAX_PER_RUN = Number(Deno.env.get('BILLING_MAX_PER_RUN') ?? '50');
const MAX_TRIES = 4;          // 거절당해도 이만큼만 해 봅니다
const RETRY_DAYS = 3;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 1), { status: s, headers: { 'Content-Type': 'application/json' } });

/* 토스에 한 번 긁습니다. subscription 함수의 것과 같은 방식입니다.
   orderId 는 우리가 만들고 한 번만 씁니다 — 같은 값을 두 번 보내면 토스가 막습니다. */
async function 긁기(billingKey: string, customerKey: string | null, amount: number, label: string, companyId: string) {
  if (PG_PROVIDER === 'stub') {
    if (!billingKey.startsWith('stub_')) return { ok: false as const, message: '결제 수단을 확인하지 못했습니다.' };
    return { ok: true as const, stub: true, orderId: 'stub_' + Date.now().toString(36) };
  }
  if (!PG_SECRET) return { ok: false as const, message: '결제 설정이 완료되지 않았습니다.' };
  if (!customerKey) return { ok: false as const, message: '결제 수단에 고객 식별자가 없습니다. 카드를 다시 등록해야 합니다.' };

  const orderId = 'dnalabs_' + companyId.replace(/-/g, '').slice(0, 12) + '_' + Date.now().toString(36);
  let res: Response;
  try {
    res = await fetch('https://api.tosspayments.com/v1/billing/' + encodeURIComponent(billingKey), {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + btoa(PG_SECRET + ':'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerKey, amount: Math.round(amount), orderId, orderName: label.slice(0, 100) }),
    });
  } catch {
    return { ok: false as const, message: '결제사에 닿지 못했습니다.' };
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, message: String(d?.message ?? '결제사가 거절했습니다.') + ' [' + String(d?.code ?? res.status) + ']' };
  if (d?.status !== 'DONE') return { ok: false as const, message: '결제가 완료되지 않았습니다 (' + String(d?.status ?? '?') + ').' };
  return { ok: true as const, paymentKey: String(d.paymentKey ?? ''), orderId, approvedAt: String(d.approvedAt ?? '') };
}

const 한달뒤 = (d: Date) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  // 자물쇠가 없으면 문을 열지 않습니다. 실수로 열어 두는 쪽이 더 위험합니다.
  if (!SECRET) return json({ ok: false, error: 'BILLING_SECRET 이 설정되지 않아 돌지 않습니다.' }, 503);
  if (req.headers.get('x-billing-secret') !== SECRET) return json({ ok: false, error: '허용되지 않습니다.' }, 403);

  const 연습 = !LIVE || new URL(req.url).searchParams.get('dry') === '1';
  const 지금 = new Date();

  // 적용 시점이 지난 요금제 변경을 먼저 반영합니다. 안 그러면 옛 금액으로 걷습니다.
  await admin.rpc('apply_due_plan_changes');

  const { data: subs, error: e0 } = await admin.from('subscriptions')
    .select('company_id, plan_key, plan_name, price, status, period_start, period_end, trial_ends_at')
    .in('status', ['trialing', 'active', 'past_due'])
    .lte('period_end', 지금.toISOString())
    .order('period_end', { ascending: true })
    .limit(MAX_PER_RUN);

  if (e0) { console.error('[요금걷기] 구독 읽기 실패', e0.message); return json({ ok: false, error: e0.message }, 500) }

  const 결과: Record<string, unknown>[] = [];
  let 걷음 = 0, 실패 = 0, 건너뜀 = 0, 적어둠 = 0;

  for (const s of subs ?? []) {
    const due = new Date(s.period_end as string);
    const 다음끝 = 한달뒤(due);
    const 금액 = Number(s.price) || 0;
    const 한줄 = { code: s.company_id, plan: s.plan_key, amount: 금액, due: s.period_end };

    // 이미 처리한 기간인지. (company_id, due_on) 이 열쇠입니다.
    const { data: 있던것 } = await admin.from('billing_charges')
      .select('id, status, tries, next_try_at')
      .eq('company_id', s.company_id).eq('due_on', due.toISOString()).maybeSingle();

    if (있던것?.status === 'paid') { 건너뜀++; 결과.push({ ...한줄, 결과: '이미 걷음' }); continue }
    if (있던것?.status === 'failed' && (있던것.tries ?? 0) >= MAX_TRIES) {
      건너뜀++; 결과.push({ ...한줄, 결과: '재시도 한도 초과 — 사람이 봐야 합니다' }); continue;
    }
    if (있던것?.next_try_at && new Date(있던것.next_try_at as string) > 지금) {
      건너뜀++; 결과.push({ ...한줄, 결과: '다시 할 때가 아직 안 됨' }); continue;
    }

    const 밑줄 = {
      company_id: s.company_id, due_on: due.toISOString(),
      period_start: due.toISOString(), period_end: 다음끝.toISOString(),
      amount: 금액, plan_key: s.plan_key, plan_name: s.plan_name, provider: PG_PROVIDER,
    };

    // 0원(체험 중 무료 등)·협의 요금제는 걷을 것이 없습니다. 기간만 넘깁니다.
    if (금액 <= 0) {
      await admin.from('billing_charges').upsert(
        { ...밑줄, status: 'skipped' }, { onConflict: 'company_id,due_on' });
      await admin.from('subscriptions').update({
        status: 'active', period_start: due.toISOString(), period_end: 다음끝.toISOString(),
      }).eq('company_id', s.company_id);
      건너뜀++; 결과.push({ ...한줄, 결과: '0원 — 기간만 넘김' }); continue;
    }

    // ── 연습 모드 — 여기서 멈춥니다. 카드는 건드리지 않습니다 ──
    if (연습) {
      await admin.from('billing_charges').upsert(
        { ...밑줄, status: 'planned' }, { onConflict: 'company_id,due_on' });
      적어둠++; 결과.push({ ...한줄, 결과: '연습 — 걷을 차례라고 적어만 둠' }); continue;
    }

    const { data: bm } = await admin.from('billing_methods')
      .select('billing_key, customer_key').eq('company_id', s.company_id).maybeSingle();

    if (!bm?.billing_key) {
      await admin.from('billing_charges').upsert({
        ...밑줄, status: 'failed', tries: (있던것?.tries ?? 0) + 1,
        next_try_at: null, last_error: '등록된 결제 수단이 없습니다.',
      }, { onConflict: 'company_id,due_on' });
      await admin.from('subscriptions').update({ status: 'past_due' }).eq('company_id', s.company_id);
      실패++; 결과.push({ ...한줄, 결과: '결제 수단 없음' }); continue;
    }

    const r = await 긁기(bm.billing_key, bm.customer_key, 금액, `Re:Service ${s.plan_name ?? ''}`.trim(), s.company_id);

    if (r.ok) {
      await admin.from('billing_charges').upsert({
        ...밑줄, status: 'paid', tries: (있던것?.tries ?? 0) + 1, next_try_at: null, last_error: null,
        payment_key: (r as { paymentKey?: string }).paymentKey ?? null,
        order_id: r.orderId, charged_at: 지금.toISOString(),
      }, { onConflict: 'company_id,due_on' });
      // 기간을 넘깁니다. 이제 다음 달이 됩니다.
      await admin.from('subscriptions').update({
        status: 'active', period_start: due.toISOString(), period_end: 다음끝.toISOString(),
      }).eq('company_id', s.company_id);
      await admin.from('audit_log').insert({
        company_id: s.company_id, actor_id: null, action: 'billing_charged', target: s.plan_key,
        detail: { amount: 금액, order_id: r.orderId, period_end: 다음끝.toISOString() },
      });
      걷음++; 결과.push({ ...한줄, 결과: '걷음' });
    } else {
      const 번째 = (있던것?.tries ?? 0) + 1;
      const 더할까 = 번째 < MAX_TRIES;
      await admin.from('billing_charges').upsert({
        ...밑줄, status: 'failed', tries: 번째,
        next_try_at: 더할까 ? new Date(지금.getTime() + RETRY_DAYS * 864e5).toISOString() : null,
        last_error: r.message,
      }, { onConflict: 'company_id,due_on' });
      // 기간은 넘기지 않습니다. 돈을 못 받았으니 다음 달로 넘어가면 안 됩니다.
      await admin.from('subscriptions').update({ status: 'past_due' }).eq('company_id', s.company_id);
      console.error('[요금걷기] 실패', s.company_id, 번째 + '번째', r.message);
      실패++; 결과.push({ ...한줄, 결과: '실패(' + 번째 + '번째) — ' + r.message });
    }
  }

  const 요약 = {
    ok: true, 모드: 연습 ? '연습 — 카드를 건드리지 않았습니다' : '실제',
    돈: PG_PROVIDER, 대상: (subs ?? []).length, 걷음, 실패, 건너뜀, 적어둠,
    상한: MAX_PER_RUN, 시각: 지금.toISOString(), 자세히: 결과,
  };
  console.log('[요금걷기]', JSON.stringify({ ...요약, 자세히: undefined }));
  return json(요약);
});
