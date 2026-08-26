// 명함 자동 인식 — Claude API 대행
//
// 이 함수가 있는 이유는 하나입니다.
// API 키를 브라우저에 두지 않기 위해서입니다.
// 키는 서버 환경변수에만 있고, 로그인한 사람만 부를 수 있습니다.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5';
const DAILY_LIMIT = Number(Deno.env.get('CARD_DAILY_LIMIT') ?? '200');
const MAX_BYTES = 6 * 1024 * 1024;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);
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

  // ── 하루 사용량 제한 ── (키가 새어도 피해가 한정되도록)
  const since = new Date(Date.now() - 86400000).toISOString();
  const { count } = await admin.from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', prof.id).eq('action', 'card.read').gte('at', since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return json({ ok: false, error: '오늘 명함 인식 한도를 넘었습니다. 직접 입력해 주세요.' }, 429);
  }

  let body: Record<string, unknown>;
  try { body = await req.json() } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400) }

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
