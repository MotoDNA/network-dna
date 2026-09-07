// 홈페이지(dnalabs.kr)가 부르는 자리 — **로그인 없이** 누구나 부릅니다.
//
// ── ops 와 왜 나눴나 ──
// ops 는 운영자만 부르는, 힘이 다 모인 함수입니다. 거기에 "누구나 부를 수 있는"
// 길을 하나라도 내면 그 길이 곧 통로가 됩니다. 아예 다른 파일로 둡니다.
// 이 함수가 할 수 있는 일은 셋뿐입니다 — 문의 넣기 · 방문 세기 · 고친 글 내주기.
// 읽는 것도 못 합니다(문의 목록은 여기서 안 나옵니다).
//
// 배포:
//   supabase functions deploy site --no-verify-jwt --project-ref izrtclsqhsgkuwsffifn
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mkJson } from '../_shared/cors.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// 개인정보 처리방침에 적는 보관기간과 같은 값이어야 합니다.
const KEEP_DAYS = 180;

/* ── 너무 자주 부르면 막습니다 ──
   메모리에 셉니다. 함수가 새로 뜨면 잊어버리지만, 여기서 막는 것은
   "한 사람이 연달아 백 번 넣는 것" 이라 그 정도로 충분합니다.
   (가맹점 핀처럼 뚫으면 끝나는 자물쇠가 아니라, 그냥 소음 줄이기입니다.) */
const 최근 = new Map<string, { n: number; at: number }>();
function 너무자주(key: string, cap: number, ms = 60_000): boolean {
  const now = Date.now();
  const cur = 최근.get(key);
  if (!cur || now - cur.at > ms) { 최근.set(key, { n: 1, at: now }); return false }
  cur.n++;
  if (최근.size > 5000) 최근.clear();
  return cur.n > cap;
}

const 자르기 = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

Deno.serve(async (req) => {
  const { cors, json } = mkJson(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json() } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400) }
  const action = String(body.action ?? '');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  /* ── 방문 세기 ──
     날짜 × 경로별 숫자만 올립니다. 누가 왔는지는 담지 않습니다 —
     IP·쿠키·기기표시를 안 남기므로 개인정보가 아니고, 동의창이 필요 없습니다.
     실패해도 조용히 넘어갑니다. 통계 때문에 홈페이지가 느려지면 안 됩니다. */
  if (action === 'hit') {
    if (너무자주('hit:' + ip, 120)) return json({ ok: true });   // 막았다고 알리지도 않습니다
    const path = 자르기(body.path, 120) || '/';
    if (!/^\/[\w\-./가-힣]*$/.test(path)) return json({ ok: true });
    try { await admin.rpc('site_hit', { p_path: path }) } catch { /* 조용히 */ }
    return json({ ok: true });
  }

  /* ── 고쳐 둔 글 내주기 ──
     운영 화면에서 급히 고친 글이 있으면 그것만 내줍니다. 없으면 빈 목록이고,
     그때는 홈페이지가 HTML 에 박힌 원래 글을 그대로 씁니다. */
  if (action === 'copy') {
    const { data } = await admin.from('site_copy').select('key, value');
    const out: Record<string, string> = {};
    for (const r of (data ?? [])) out[r.key] = r.value;
    return json({ ok: true, copy: out });
  }

  /* ── 문의 넣기 ── */
  if (action === 'inquiry') {
    // 사람이 손으로 넣는 것이라 1분에 세 번이면 넉넉합니다
    if (너무자주('inq:' + ip, 3)) {
      return json({ ok: false, error: '잠시 뒤에 다시 보내 주세요.' }, 429);
    }

    // ⚠ 동의 없이 들어온 것은 아예 받지 않습니다. 표도 not null 로 막혀 있지만
    //    여기서 먼저 걸러야 "왜 안 되는지" 를 사람에게 말해 줄 수 있습니다.
    if (body.agreed !== true) {
      return json({ ok: false, error: '개인정보 수집·이용에 동의해 주셔야 보낼 수 있습니다.' }, 400);
    }

    const name = 자르기(body.name, 40);
    const contact = 자르기(body.contact, 120);
    const message = 자르기(body.message, 2000);
    if (!name) return json({ ok: false, error: '성함을 적어 주세요.' }, 400);
    if (!contact) return json({ ok: false, error: '연락받으실 곳을 적어 주세요.' }, 400);
    if (!message) return json({ ok: false, error: '무엇이 궁금하신지 적어 주세요.' }, 400);

    // 사람이 아니면 대개 이 칸을 채웁니다(화면에서는 안 보이는 칸)
    if (자르기(body.website, 100)) return json({ ok: true, id: null });

    const purge = new Date(Date.now() + KEEP_DAYS * 86400000).toISOString().slice(0, 10);
    const { data, error } = await admin.from('site_inquiries').insert({
      name, contact, message,
      company: 자르기(body.company, 60),
      want: 자르기(body.want, 20),
      people: 자르기(body.people, 20),
      source: 자르기(body.source, 40),
      agreed_at: new Date().toISOString(),
      purge_on: purge,
    }).select('id').single();

    if (error || !data) {
      console.error('inquiry insert', error?.message);
      return json({ ok: false, error: '보내지 못했습니다. 잠시 뒤 다시 해 주시거나 hello@dnalabs.kr 로 보내 주세요.' }, 500);
    }
    return json({ ok: true, id: data.id, keepDays: KEEP_DAYS });
  }

  return json({ ok: false, error: '알 수 없는 요청입니다.' }, 400);
});
