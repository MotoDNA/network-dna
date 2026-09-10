// 회원가입 — 업종 판정 · 요금제 확정 · 회사코드 발급
//
// 로그인 없이 부를 수 있는 유일한 창구입니다. 그래서 두 가지를 지킵니다.
//
//  1. 화면이 보낸 값을 하나도 믿지 않습니다.
//     업종 등급도, 요금제도, 좌석 수도 여기서 catalog 를 보고 다시 정합니다.
//     화면은 편의를 위해 먼저 검사할 뿐이고, 진짜 판정은 여기입니다.
//
//  2. 카드번호는 여기에도 오지 않습니다.
//     결제대행사에서 받은 빌링키만 받아서, 그 키가 살아 있는지 0원 승인으로
//     확인하고 저장합니다. 카드번호는 우리 쪽 어디에도 남지 않습니다.
//
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mkJson } from '../_shared/cors.ts';
import { CATALOG, plan, seatsFit, gradeOf } from '../_shared/catalog.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PG_PROVIDER = Deno.env.get('PG_PROVIDER') ?? 'stub';
const PG_SECRET = Deno.env.get('PG_SECRET_KEY') ?? '';

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// admin-user 와 같은 규칙입니다. .invalid 는 규격상 존재할 수 없는 도메인이라
// 이 주소로 메일이 나갈 일이 없습니다. 로그인 아이디를 만들기 위한 것뿐입니다.
const emailFor = (loginId: string, code: string) =>
  `${loginId.toLowerCase()}@${code.toLowerCase()}.ndna.invalid`;

const ADMIN_ID = 'admin';
const MAX_TRIES_PER_HOUR = 8;

/* 옮겨 적기 쉬운 비밀번호를 만듭니다.
   0/O, 1/l/I 처럼 헷갈리는 글자는 뺐습니다 —
   화면에 한 번만 보여 주고 손으로 옮겨 적으셔야 하기 때문입니다. */
function makePassword(len = 14): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ';   // I, L, O 제외
  const a = 'abcdefghijkmnpqrstuvwxyz';  // l, o 제외
  const d = '23456789';                  // 0, 1 제외
  const s = '!@#$%^&*';
  const all = A + a + d + s;
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  // 종류별로 최소 하나씩은 들어가게 앞자리를 채우고 나머지를 섞습니다
  const out = [
    A[buf[0] % A.length], a[buf[1] % a.length],
    d[buf[2] % d.length], s[buf[3] % s.length],
  ];
  for (let i = 4; i < len; i++) out.push(all[buf[i] % all.length]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';
}

async function note(ip: string, email: string | null, ok: boolean, reason: string | null) {
  await admin.from('signup_attempts').insert({ ip, email, ok, reason });
}

/* ── 결제대행사 · 0원 승인 ──────────────────────────────
   화면에서도 한 번 확인했지만 그것은 믿지 않습니다.
   화면은 얼마든지 조작할 수 있으므로, 진짜 확인은 여기서 합니다.

   실제 PG 를 붙일 때 이 함수만 채우면 됩니다. 시크릿 키가 필요하므로
   반드시 서버에서만 부릅니다 — 브라우저로 내려보내면 안 됩니다. */

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

/* 토스 카드 발급사 코드 → 이름. 화면에 "어느 카드인지" 보여 주려는 것뿐이라
   모르는 코드는 코드 그대로 둡니다. 결제에는 안 쓰입니다. */
const 발급사: Record<string, string> = {
  '3K':'기업BC', '46':'광주', '71':'롯데', '30':'산업', '31':'BC', '51':'삼성', '38':'새마을',
  '41':'신한', '62':'신협', '36':'씨티', '33':'우리', '37':'우체국', '39':'저축', '35':'전북',
  '42':'제주', '15':'카카오뱅크', '3A':'케이뱅크', '24':'토스뱅크', '21':'하나', '61':'현대',
  '11':'국민', '91':'농협', '34':'수협',
};

type 결제수단 = { ok: true; billingKey: string; customerKey: string; cardBrand: string | null; cardLast4: string | null }
             | { ok: false; message: string };

/* ── 결제 수단 확정 ──
   stub — 화면이 준 가짜 빌링키를 그대로 씁니다.
   toss — 화면은 authKey 만 들고 옵니다. 여기서 진짜 빌링키를 발급받습니다.
          토스는 0원 승인이 없고, 발급 자체가 카드 확인입니다(안 되는 카드면 여기서 거절).
          시크릿 키가 필요해 반드시 서버에서만 합니다. */
async function pgResolveBilling(body: Record<string, unknown>): Promise<결제수단> {
  if (PG_PROVIDER === 'stub') {
    const k = String(body.billingKey ?? '');
    if (!k.startsWith('stub_')) return { ok: false, message: '결제 수단 확인에 실패했습니다.' };
    return { ok: true, billingKey: k, customerKey: String(body.customerKey ?? ''), cardBrand: '테스트카드', cardLast4: '0000' };
  }

  if (!PG_SECRET) return { ok: false, message: '결제 설정이 완료되지 않았습니다.' };
  const authKey = String(body.authKey ?? ''), customerKey = String(body.customerKey ?? '');
  if (!authKey || !customerKey) return { ok: false, message: '카드 등록 결과를 받지 못했습니다. 다시 시도해 주세요.' };
  if (!/^[A-Za-z0-9\-_=.@]{2,50}$/.test(customerKey)) return { ok: false, message: '고객 식별자가 올바르지 않습니다.' };

  const r = await tossCall('/v1/billing/authorizations/issue', { authKey, customerKey });
  if (!r.ok) return { ok: false, message: '카드를 등록하지 못했습니다: ' + r.message };
  const d = r.data as { billingKey?: string; customerKey?: string; card?: { number?: string; issuerCode?: string } };
  if (!d.billingKey) return { ok: false, message: '결제사가 빌링키를 주지 않았습니다.' };

  const 번호 = String(d.card?.number ?? '');                    // 433012******1234 처럼 가려져 옵니다
  const last4 = /\d{4}$/.test(번호) ? 번호.slice(-4) : null;
  const code = String(d.card?.issuerCode ?? '');
  return { ok: true, billingKey: d.billingKey, customerKey: d.customerKey ?? customerKey,
           cardBrand: code ? (발급사[code] ?? code) : null, cardLast4: last4 };
}

Deno.serve(async (req) => {
  const { cors, json } = mkJson(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'POST 만 받습니다.' }, 405);

  const ip = clientIp(req);

  // ── 같은 곳에서 너무 자주 두드리는 것 막기 ──
  const { data: tries } = await admin.rpc('signup_attempts_recent', { p_ip: ip });
  if (typeof tries === 'number' && tries >= MAX_TRIES_PER_HOUR) {
    return json({ message: '가입 시도가 너무 잦습니다. 잠시 뒤 다시 시도해 주세요.' }, 429);
  }

  let b: Record<string, unknown>;
  try { b = await req.json() } catch { return json({ message: '잘못된 요청입니다.' }, 400) }

  const industryId = String(b.industryId ?? '');
  const planKey = String(b.planKey ?? '');
  const seats = Number(b.seats);
  const company = String(b.company ?? '').trim();
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const phone = String(b.phone ?? '').trim();
  const agreed = (b.agreed ?? {}) as Record<string, boolean>;
  const billingKey = String(b.billingKey ?? '');

  const fail = async (msg: string, status = 400) => {
    await note(ip, email || null, false, msg);
    return json({ message: msg }, status);
  };

  // ── 1. 업종 — 여기가 진짜 판정입니다 ──
  const grade = gradeOf(industryId);
  if (!grade) return await fail('업종을 다시 골라 주세요.');
  if (grade === 'C') {
    return await fail('선택하신 업종은 Re:Call 을 쓰실 수 없습니다. 법이 그 정보의 외부 반출을 막고 있습니다.', 403);
  }

  // ── 2. 요금제와 인원 ──
  const p = plan(planKey);
  if (!p) return await fail('요금제를 다시 골라 주세요.');
  if (p.per === 'quote') return await fail('50명 이상은 따로 문의해 주세요.');
  if (!seatsFit(p, seats)) {
    return await fail(`${p.name} 는 ${p.seatMin}명부터 ${p.seatMax}명까지입니다.`);
  }

  // ── 3. 적어 주신 것 ──
  if (company.length < 2) return await fail('회사 이름을 확인해 주세요.');
  if (name.length < 2) return await fail('담당자 이름을 확인해 주세요.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return await fail('이메일을 확인해 주세요.');
  if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone.replace(/\s/g, ''))) {
    return await fail('연락처를 확인해 주세요.');
  }

  // ── 4. 필수 동의 ──
  for (const k of ['tos', 'privacy', 'billing']) {
    if (!agreed[k]) return await fail('필수 항목에 동의해 주셔야 가입됩니다.');
  }

  // ── 5. 이미 가입한 메일인지 ──
  const { data: dup } = await admin.from('companies')
    .select('id').ilike('contact_email', email).maybeSingle();
  if (dup) {
    return await fail('이미 가입된 이메일입니다. 로그인하시거나 비밀번호를 재발급해 주세요.', 409);
  }

  // ── 6. 결제 수단 확정 (stub 은 확인, toss 는 발급) ──
  const bill = await pgResolveBilling(body);
  if (!bill.ok) return await fail(bill.message, 402);

  // ── 7. 만들기 ──
  // 중간에 실패하면 만든 것을 되돌립니다. 회사만 남고 계정이 없는 상태가
  // 생기면 그 회사코드는 영영 못 쓰게 되기 때문입니다.
  const { data: code, error: eCode } = await admin.rpc('gen_company_code');
  if (eCode || !code) return await fail('회사코드를 발급하지 못했습니다.', 500);

  const trialDays = Number(p.trialDays) || 0;
  const now = new Date();
  const trialEnds = trialDays ? new Date(now.getTime() + trialDays * 864e5) : null;
  const periodEnd = trialEnds ?? new Date(new Date(now).setMonth(now.getMonth() + 1));

  const { data: comp, error: e1 } = await admin.from('companies').insert({
    code, name: company,
    industry_id: industryId, industry_grade: grade,
    contact_name: name, contact_email: email, contact_phone: phone,
  }).select('id').single();

  if (e1 || !comp) {
    const dupe = e1?.code === '23505';
    return await fail(
      dupe ? '이미 가입된 이메일입니다.' : '회사를 만들지 못했습니다.',
      dupe ? 409 : 500,
    );
  }

  const undo = async () => { await admin.from('companies').delete().eq('id', comp.id) };

  const password = makePassword();
  const { data: created, error: e2 } = await admin.auth.admin.createUser({
    email: emailFor(ADMIN_ID, code), password, email_confirm: true,
    user_metadata: { company_code: code, login_id: ADMIN_ID },
  });
  if (e2 || !created?.user) {
    await undo();
    return await fail('계정을 만들지 못했습니다.', 500);
  }

  const undo2 = async () => {
    await admin.auth.admin.deleteUser(created.user!.id);
    await undo();
  };

  // 구독을 프로필보다 먼저 넣습니다.
  // 좌석 제한 트리거가 subscriptions 를 보기 때문에, 순서가 바뀌면
  // 첫 관리자 계정이 "구독 없음"으로 취급됩니다.
  const { error: e3 } = await admin.from('subscriptions').insert({
    company_id: comp.id,
    plan_key: p.key,
    plan_name: p.name,          // 판 시점의 이름과 금액을 박아 둡니다
    price: p.price,
    seat_limit: p.seatMax,
    status: trialDays ? 'trialing' : 'active',
    trial_ends_at: trialEnds?.toISOString() ?? null,
    period_start: now.toISOString(),
    period_end: periodEnd.toISOString(),
  });
  if (e3) { await undo2(); return await fail('구독 정보를 만들지 못했습니다.', 500) }

  const { error: e4 } = await admin.from('profiles').insert({
    id: created.user.id, company_id: comp.id,
    login_id: ADMIN_ID, name, role: 'admin',
  });
  if (e4) { await undo2(); return await fail('관리자 계정을 만들지 못했습니다.', 500) }

  const { error: e5 } = await admin.from('billing_methods').insert({
    company_id: comp.id,
    provider: PG_PROVIDER,
    billing_key: bill.billingKey,
    customer_key: bill.customerKey || null,
    card_brand: bill.cardBrand,
    card_last4: bill.cardLast4,
  });
  if (e5) { await undo2(); return await fail('결제 수단을 저장하지 못했습니다.', 500) }

  await admin.from('audit_log').insert({
    company_id: comp.id, actor_id: created.user.id,
    action: 'signup', target: code,
    detail: {
      plan: p.key, seats, seat_limit: p.seatMax,
      industry: industryId, grade,
      pg: PG_PROVIDER,
      marketing: !!agreed.market,
      oversea: !!agreed.oversea,
    },
  });
  await note(ip, email, true, null);

  return json({
    companyCode: code,
    loginId: ADMIN_ID,
    password,                                    // 이 한 번만 나갑니다. 저장하지 않습니다.
    planKey: p.key,
    planName: p.name,
    seatLimit: p.seatMax,
    trialEndsAt: trialEnds ? trialEnds.toISOString().slice(0, 10) : null,
    catalogRevision: CATALOG.revision,
  });
});
