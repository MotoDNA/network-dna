// 명함 자동 인식 — Claude API 대행
//
// 이 함수가 있는 이유는 하나입니다.
// API 키를 브라우저에 두지 않기 위해서입니다.
// 키는 서버 환경변수에만 있고, 로그인한 사람만 부를 수 있습니다.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mkJson } from '../_shared/cors.ts';
import { plan } from '../_shared/catalog.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
// 요금제를 알 수 없을 때만 쓰는 값입니다.
// 0003 이 아직 안 들어간 서버, 그리고 유료 전환 전에 만들어진 회사가 여기 걸립니다.
const FALLBACK_DAILY = Number(Deno.env.get('CARD_DAILY_LIMIT') ?? '200');

// 한국시간은 UTC+9 로 고정입니다(서머타임 없음). 그래서 오프셋 하나로 끝납니다.
const KST = 9 * 60 * 60 * 1000;

// 「하루」는 한국시간 자정 기준 달력 날짜입니다.
// 최근 24시간으로 세면 오후에 한도를 채운 사람이 다음날 오후까지 막힙니다.
// 전시회에서 이틀 연속 쓰는 분에게는 그대로 사고라서 달력 기준으로 둡니다.
function kstDayStart(now: number): string {
  const d = Math.floor((now + KST) / 86400000) * 86400000;
  return new Date(d - KST).toISOString();
}

// 「한 달」은 한국시간 매월 1일 자정입니다.
// 결제 주기가 아니라 달력 달인 것은 의도한 것입니다 —
// 20일에 가입한 회사가 1일에 한도를 새로 받는 것은 손해가 아니고, 설명하기도 쉽습니다.
function kstMonthStart(now: number): string {
  const k = new Date(now + KST);          // UTC 필드가 곧 한국시간 벽시계입니다
  const m = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1);
  return new Date(m - KST).toISOString();
}
const MAX_BYTES = 6 * 1024 * 1024;
const SETUP_SECRET = Deno.env.get('SETUP_SECRET') ?? '';

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// ── 한도와 사용량을 한 군데서 계산합니다 ──
// 명함을 읽을 때(막을지 판단)와 설정 화면에 보여줄 때가 같은 값을 써야 합니다.
// 두 군데서 따로 세면 "화면엔 여유 있는데 실제로는 막히는" 일이 납니다.
//
// 숫자는 catalog.json 에서 옵니다. 여기에 적지 마세요.
// 요금제를 못 읽으면(0003 없음 · 예전 회사) 조용히 기본값으로 내려갑니다.
async function cardUsage(profId: string, companyId: string | null) {
  const nowMs = Date.now();

  let dailyLimit = FALLBACK_DAILY;
  let monthlyLimit: number | null = null;
  try {
    const { data: sub, error } = await admin.from('subscriptions')
      .select('plan_key').eq('company_id', companyId).maybeSingle();
    if (!error && sub) {
      const p = plan(String(sub.plan_key)) as Record<string, unknown> | null;
      if (p) {
        if (typeof p.cardDailyLimit === 'number') dailyLimit = p.cardDailyLimit;
        if (typeof p.cardMonthlyLimit === 'number') monthlyLimit = p.cardMonthlyLimit;
      }
    }
  } catch { /* 표가 없습니다. 기본값으로 갑니다 */ }

  // 하루는 1인 기준, 한 달은 회사 전체 기준입니다.
  const { count: usedToday } = await admin.from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', profId).eq('action', 'card.read')
    .gte('at', kstDayStart(nowMs));

  let usedMonth: number | null = null;
  if (monthlyLimit !== null) {
    const { count } = await admin.from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('action', 'card.read')
      .gte('at', kstMonthStart(nowMs));
    usedMonth = count ?? 0;
  }

  return { dailyLimit, monthlyLimit, usedToday: usedToday ?? 0, usedMonth };
}

const PROMPT = [
  '명함 사진입니다. 인쇄된 글자를 읽어 아래 항목만 뽑아 주세요.',
  '- company: 회사명 (한글이 있으면 한글 우선)',
  '- name: 사람 이름만 (인쇄된 그대로. 한글과 영문이 함께 있으면 한글)',
  '- title: 직함. 없으면 빈 문자열',
  '- phone: 휴대폰 번호 우선, 없으면 대표번호. 숫자와 하이픈만',
  '- email: 이메일 주소',
  '- address: 회사 주소',
  '읽을 수 없는 항목은 빈 문자열로 두세요. 추측하지 말고 보이는 대로만 적으세요.',
  '오직 JSON만 출력하고 다른 말은 절대 쓰지 마세요.',
  '{"company":"","name":"","title":"","phone":"","email":"","address":""}',
].join('\n');

Deno.serve(async (req) => {
  // 부른 곳에 맞춘 cors 와 json 을 꺼냅니다
  const { cors, json } = mkJson(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json() } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400) }

  // ── 설치 점검 ──
  // API 키가 제대로 들어갔는지 로그인 없이 확인합니다.
  // 설치 암호를 아는 사람만 부를 수 있고, 키 값은 어떤 형태로도 내보내지 않습니다.
  // 알려 주는 것은 길이·형식과 실제로 Anthropic 이 받아 주는지 여부뿐입니다.
  if (String(body.action ?? '') === 'selftest') {
    if (!SETUP_SECRET || req.headers.get('x-setup-secret') !== SETUP_SECRET) {
      return json({ ok: false, error: '설치 암호가 맞지 않습니다.' }, 401);
    }
    const k = ANTHROPIC_KEY;
    const shape = {
      '설정됨': k.length > 0,
      '길이': k.length,
      'sk-ant- 로 시작': k.startsWith('sk-ant-'),
      '앞뒤 공백 있음': k !== k.trim(),
      '모델': MODEL,
    };
    if (!k) return json({ ok: false, key: shape, error: '키가 비어 있습니다.' });
    if (!k.startsWith('sk-ant-')) {
      return json({ ok: false, key: shape, error: '키가 sk-ant- 로 시작하지 않습니다. 잘못 복사되었습니다.' });
    }
    if (k.length < 50) {
      return json({ ok: false, key: shape, error: '키가 너무 짧습니다. 붙여넣다 잘렸습니다.' });
    }

    // 형식이 맞아도 실제로 받아 주는지는 불러 봐야 압니다. 가장 작은 호출을 한 번 보냅니다.
    let status = 0, detail = '';
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': k,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      status = r.status;
      if (!r.ok) detail = (await r.text()).slice(0, 200);
    } catch {
      return json({ ok: false, key: shape, error: 'Anthropic 에 닿지 못했습니다.' });
    }
    if (status === 401 || status === 403) {
      return json({ ok: false, key: shape, anthropic: status, detail,
                    error: '키가 거부되었습니다. 대시보드에서 다시 넣어 주세요.' });
    }
    if (status >= 400) {
      return json({ ok: false, key: shape, anthropic: status, detail,
                    error: 'Anthropic 이 오류를 냈습니다.' });
    }
    return json({ ok: true, key: shape, anthropic: status, message: '키가 정상입니다.' });
  }

  if (!ANTHROPIC_KEY) return json({ ok: false, error: '서버에 API 키가 설정되지 않았습니다.' }, 500);

  // ── 로그인 확인 ──
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  const anon = createClient(URL_, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: udata } = await anon.auth.getUser();
  if (!udata?.user) return json({ ok: false, error: '로그인이 만료되었습니다.' }, 401);

  const { data: prof } = await admin.from('profiles')
    .select('id, company_id, disabled').eq('id', udata.user.id).single();
  if (!prof || prof.disabled) return json({ ok: false, error: '사용할 수 없는 계정입니다.' }, 403);

  // ── 사용량 조회 ──
  // 설정 화면이 "오늘 12/100" 을 보여줄 때 부릅니다.
  // 한도 숫자를 앱에 박아 두지 않으려고 서버가 알려 줍니다 —
  // 앱은 catalog.json 을 볼 수 없는 다른 주소에서 돕니다.
  if (String(body.action ?? '') === 'usage') {
    const u = await cardUsage(prof.id, prof.company_id);
    return json({ ok: true, usage: u });
  }

  // ── 사용량 제한 ──
  // 영업용 숫자가 아니라 사고 방지선입니다. 계정이 털리거나 키가 새어도
  // 손실이 한 달 요금 안에서 끝나도록 막습니다.
  //
  //   하루  = 1인 기준 (actor_id).   전시회 하루를 견디는 크기입니다.
  //   한 달 = 회사 전체 (company_id). 실제 방어선은 이쪽입니다.
  //
  // ⚠ 이 질의는 audit_log 를 셉니다. recall_0004_card_limits.sql 의 인덱스가
  //   없으면 회사가 커질수록 명함 찍을 때마다 느려집니다.
  const lim = await cardUsage(prof.id, prof.company_id);

  if (lim.usedToday >= lim.dailyLimit) {
    return json({ ok: false, error:
      '오늘 인식할 수 있는 명함(' + lim.dailyLimit + '장)을 다 쓰셨습니다. ' +
      '내일 다시 쓰실 수 있고, 지금은 직접 입력해 주세요.' }, 429);
  }

  if (lim.monthlyLimit !== null && (lim.usedMonth ?? 0) >= lim.monthlyLimit) {
    return json({ ok: false, error:
      '이번 달 회사 전체 명함 인식 한도(' + lim.monthlyLimit + '장)를 다 썼습니다. ' +
      '다음 달 1일에 다시 채워집니다. 더 필요하시면 알려 주세요.' }, 429);
  }

  const b64 = String(body.image ?? '');
  if (!b64) return json({ ok: false, error: '사진이 없습니다.' }, 400);
  if (b64.length * 0.75 > MAX_BYTES) return json({ ok: false, error: '사진이 너무 큽니다.' }, 413);

  // ── Claude 호출 ──
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });
  } catch (e) {
    return json({ ok: false, error: '인식 서버에 닿지 못했습니다.' }, 502);
  }
  if (!res.ok) {
    // 원문을 그대로 내보내면 키 관련 정보가 샐 수 있어 상태만 알립니다
    console.error('anthropic error', res.status, (await res.text()).slice(0, 300));
    // 401·403 은 원인이 하나뿐입니다. 헤매지 않도록 그대로 알려 줍니다.
    if (res.status === 401 || res.status === 403) {
      return json({ ok: false, error: '서버의 API 키가 올바르지 않습니다. 관리자에게 알려 주세요.' }, 502);
    }
    if (res.status === 429) {
      return json({ ok: false, error: '인식 요청이 몰렸습니다. 잠시 뒤 다시 시도해 주세요.' }, 502);
    }
    return json({ ok: false, error: '인식에 실패했습니다 (' + res.status + ')' }, 502);
  }

  const data = await res.json();
  const txt = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('')
    .replace(/```json|```/g, '').trim();

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  } catch {
    return json({ ok: false, error: '글자를 찾지 못했습니다.' }, 200);
  }

  const pick = (k: string) => String(parsed[k] ?? '').trim().slice(0, 200);
  const out = {
    company: pick('company'), name: pick('name'), title: pick('title'),
    phone: pick('phone').replace(/[^0-9+\-() ]/g, ''),
    email: pick('email'), address: pick('address'),
  };

  // 무엇을 읽었는지는 남기지 않습니다. 호출 사실만 기록합니다.
  await admin.from('audit_log').insert({
    company_id: prof.company_id, actor_id: prof.id,
    action: 'card.read', target: null, detail: { model: MODEL },
  });

  return json({ ok: true, card: out });
});
