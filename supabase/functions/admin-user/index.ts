// 계정 관리 — 회사 개설, 사용자 추가, 비밀번호 재발급, 사용 중지
//
// service_role 키를 쓰는 유일한 곳입니다.
// 키는 서버 환경변수에만 있고 브라우저로 내려가지 않습니다.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { cors, json } from '../_shared/cors.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SETUP_SECRET = Deno.env.get('SETUP_SECRET') ?? '';

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// 아이디는 메일로 보내지 않습니다. .invalid 는 규격상 절대 존재하지 않는 도메인입니다.
const emailFor = (loginId: string, code: string) =>
  `${loginId.toLowerCase()}@${code.toLowerCase()}.ndna.invalid`;

const CODE_RE = /^[A-Z0-9]{4,12}$/;
const ID_RE = /^[a-z0-9._-]{2,32}$/;

function checkPw(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (/^[0-9]+$/.test(pw)) return '숫자만으로는 안 됩니다.';
  if (/^(.)\1+$/.test(pw)) return '같은 글자만 반복할 수 없습니다.';
  const weak = ['password12', '1234567890', 'qwertyuiop', 'admin12345', 'qwer1234!@'];
  if (weak.includes(pw.toLowerCase())) return '너무 흔한 비밀번호입니다.';
  return null;
}

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

async function audit(company_id: string | null, actor_id: string | null,
                     action: string, target: string, detail: unknown) {
  await admin.from('audit_log').insert({ company_id, actor_id, action, target, detail });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json() } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400) }
  const action = String(body.action ?? '');

  /* ── 회사 개설 — 설치할 때 한 번만 ── */
  if (action === 'bootstrap') {
    if (!SETUP_SECRET) return json({ ok: false, error: 'SETUP_SECRET 이 설정되지 않았습니다.' }, 500);
    if (req.headers.get('x-setup-secret') !== SETUP_SECRET) {
      return json({ ok: false, error: '설치 암호가 맞지 않습니다.' }, 403);
    }
    const code = String(body.code ?? '').trim().toUpperCase();
    const loginId = String(body.loginId ?? 'admin').trim().toLowerCase();
    const pw = String(body.password ?? '');
    if (!CODE_RE.test(code)) return json({ ok: false, error: '회사 코드는 영문 대문자와 숫자 4~12자입니다.' }, 400);
    if (!ID_RE.test(loginId)) return json({ ok: false, error: '아이디 형식이 맞지 않습니다.' }, 400);
    const bad = checkPw(pw); if (bad) return json({ ok: false, error: bad }, 400);

    const { data: exist } = await admin.from('companies').select('id').eq('code', code).maybeSingle();
    if (exist) return json({ ok: false, error: '이미 있는 회사 코드입니다.' }, 409);

    const { data: comp, error: e1 } = await admin.from('companies')
      .insert({ code, name: String(body.companyName ?? '').trim() }).select('id').single();
    if (e1 || !comp) return json({ ok: false, error: e1?.message ?? '회사를 만들지 못했습니다.' }, 500);

    const { data: created, error: e2 } = await admin.auth.admin.createUser({
      email: emailFor(loginId, code), password: pw, email_confirm: true,
      user_metadata: { company_code: code, login_id: loginId },
    });
    if (e2 || !created?.user) {
      await admin.from('companies').delete().eq('id', comp.id);
      return json({ ok: false, error: e2?.message ?? '계정을 만들지 못했습니다.' }, 500);
    }
    const { error: e3 } = await admin.from('profiles').insert({
      id: created.user.id, company_id: comp.id, login_id: loginId,
      name: String(body.name ?? '관리자').trim(), role: 'admin',
    });
    if (e3) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from('companies').delete().eq('id', comp.id);
      return json({ ok: false, error: e3.message }, 500);
    }
    await audit(comp.id, created.user.id, 'bootstrap', code, { loginId });
    return json({ ok: true, code, loginId });
  }

  /* ── 아래는 모두 관리자만 ── */
  const me = await caller(req);
  if (!me) return json({ ok: false, error: '로그인이 필요합니다.' }, 401);
  if (me.role !== 'admin') return json({ ok: false, error: '관리자만 할 수 있습니다.' }, 403);

  const { data: myComp } = await admin.from('companies').select('code').eq('id', me.company_id).single();
  const code = String(myComp?.code ?? '');

  if (action === 'create') {
    const loginId = String(body.loginId ?? '').trim().toLowerCase();
    const pw = String(body.password ?? '');
    if (!ID_RE.test(loginId)) return json({ ok: false, error: '아이디는 영문 소문자·숫자·-_. 2~32자입니다.' }, 400);
    const bad = checkPw(pw); if (bad) return json({ ok: false, error: bad }, 400);

    const { data: dup } = await admin.from('profiles')
      .select('id').eq('company_id', me.company_id).eq('login_id', loginId).maybeSingle();
    if (dup) return json({ ok: false, error: '이미 있는 아이디입니다.' }, 409);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: emailFor(loginId, code), password: pw, email_confirm: true,
      user_metadata: { company_code: code, login_id: loginId },
    });
    if (error || !created?.user) return json({ ok: false, error: error?.message ?? '실패했습니다.' }, 500);

    const { error: e2 } = await admin.from('profiles').insert({
      id: created.user.id, company_id: me.company_id, login_id: loginId,
      name: String(body.name ?? loginId).trim(),
      role: body.role === 'admin' ? 'admin' : 'user',
    });
    if (e2) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ ok: false, error: e2.message }, 500);
    }
    await audit(me.company_id, me.id, 'user.create', loginId, { role: body.role ?? 'user' });
    return json({ ok: true, loginId });
  }

  if (action === 'reset-password') {
    const loginId = String(body.loginId ?? '').trim().toLowerCase();
    const pw = String(body.password ?? '');
    const bad = checkPw(pw); if (bad) return json({ ok: false, error: bad }, 400);
    const { data: target } = await admin.from('profiles')
      .select('id').eq('company_id', me.company_id).eq('login_id', loginId).maybeSingle();
    if (!target) return json({ ok: false, error: '그런 아이디가 없습니다.' }, 404);
    const { error } = await admin.auth.admin.updateUserById(target.id, { password: pw });
    if (error) return json({ ok: false, error: error.message }, 500);
    // 비밀번호를 바꾸면 열려 있던 로그인은 모두 끊습니다
    await admin.auth.admin.signOut(target.id, 'global').catch(() => {});
    await audit(me.company_id, me.id, 'user.reset-password', loginId, null);
    return json({ ok: true });
  }

  if (action === 'set-disabled') {
    const loginId = String(body.loginId ?? '').trim().toLowerCase();
    const off = body.disabled === true;
    if (loginId === me.login_id) return json({ ok: false, error: '자기 계정은 중지할 수 없습니다.' }, 400);
    const { data: target } = await admin.from('profiles')
      .select('id').eq('company_id', me.company_id).eq('login_id', loginId).maybeSingle();
    if (!target) return json({ ok: false, error: '그런 아이디가 없습니다.' }, 404);
    await admin.from('profiles').update({ disabled: off }).eq('id', target.id);
    if (off) await admin.auth.admin.signOut(target.id, 'global').catch(() => {});
    await audit(me.company_id, me.id, off ? 'user.disable' : 'user.enable', loginId, null);
    return json({ ok: true });
  }

  return json({ ok: false, error: '알 수 없는 요청입니다: ' + action }, 400);
});
