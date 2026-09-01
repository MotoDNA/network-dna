// 운영 화면(dnalabs.kr/admin)이 쓰는 유일한 창구입니다.
//
// ── 왜 함수 하나로 모으나 ──
// 회사 셋을 한 화면에서 보려면 RLS 를 넘어야 합니다. 정책마다 "운영자면 통과" 를
// 덧붙이는 대신, 힘을 이 파일 하나에 가둡니다. 브라우저가 들고 있는 열쇠로는
// 여전히 남의 회사가 안 보입니다. 여기 없는 일은 아무도 못 합니다.
//
// ── 문지기 ──
//   1. 로그인했는가            (JWT)
//   2. 그 사람이 operators 에 있는가
//   3. 무엇을 했는지 audit_log 에 남긴다
//
// 2번을 통과 못 하면 **왜 막혔는지 알려 주지 않습니다.** 운영 화면이 있다는 것도
// 굳이 알릴 이유가 없어서, 로그인만 확인되면 401 이 아니라 403 하나로 답합니다.
//
// ⚠ ALLOWED_ORIGIN 에 https://dnalabs.kr 이 들어 있어야 브라우저가 부를 수 있습니다.
//   그 값은 함수 여덟이 함께 씁니다 — 고칠 때 넷을 다 적으세요(_shared/cors.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mkJson } from '../_shared/cors.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const APPS = ['rebind', 'recall', 'restore'] as const;
const CODE_RE = /^[A-Z0-9]{4,12}$/;
const ID_RE = /^[a-z0-9._-]{2,32}$/;

// 아이디는 메일로 보내지 않습니다. .invalid 는 규격상 절대 존재하지 않는 도메인입니다.
const emailFor = (loginId: string, code: string) =>
  `${loginId.toLowerCase()}@${code.toLowerCase()}.ndna.invalid`;

/* 비밀번호 규칙은 admin-user 와 같은 것을 씁니다.
   두 군데가 달라지면 여기서 만든 계정이 저쪽 규칙을 어기게 됩니다. */
function checkPw(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 10) return '비밀번호는 10자 이상이어야 합니다.';
  if (/^[0-9]+$/.test(pw)) return '숫자만으로는 안 됩니다.';
  if (/^(.)\1+$/.test(pw)) return '같은 글자만 반복할 수 없습니다.';
  const weak = ['password12', '1234567890', 'qwertyuiop', 'admin12345', 'qwer1234!@'];
  if (weak.includes(pw.toLowerCase())) return '너무 흔한 비밀번호입니다.';
  return null;
}

async function operator(req: Request) {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const anon = createClient(URL_, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await anon.auth.getUser();
  if (!data?.user) return null;

  const { data: prof } = await admin.from('profiles')
    .select('id, login_id, name, disabled').eq('id', data.user.id).maybeSingle();
  if (!prof || prof.disabled) return null;

  const { data: op } = await admin.from('operators')
    .select('user_id').eq('user_id', prof.id).maybeSingle();
  if (!op) return null;
  return prof;
}

async function audit(company_id: string | null, actor_id: string,
                     action: string, target: string, detail: unknown) {
  await admin.from('audit_log').insert({ company_id, actor_id, action, target, detail });
}

/* 회사별로 몇 개씩 있는지 셉니다.
   표마다 따로 물어보면 회사 셋 × 표 여섯 = 열여덟 번입니다.
   한 번에 묶어 세고 회사 id 로 나눕니다. */
async function counts(table: string, extra?: (q: any) => any) {
  let q = admin.from(table).select('company_id');
  if (extra) q = extra(q);
  const { data } = await q;
  const m: Record<string, number> = {};
  for (const r of (data ?? [])) m[r.company_id] = (m[r.company_id] ?? 0) + 1;
  return m;
}

Deno.serve(async (req) => {
  const { cors, json } = mkJson(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json() } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400) }
  const action = String(body.action ?? '');

  const me = await operator(req);
  if (!me) return json({ ok: false, error: '들어올 수 없습니다.' }, 403);

  /* ── 나는 누구인가 ── */
  if (action === 'me') {
    return json({ ok: true, me: { id: me.id, loginId: me.login_id, name: me.name } });
  }

  /* ── 한눈에 보기 ── */
  if (action === 'overview') {
    const { data: comps } = await admin.from('companies')
      .select('id, code, name, apps, disabled, created_at').order('created_at');

    const [prj, cust, act, ord, str, prof, sub] = await Promise.all([
      counts('projects', (q: any) => q.eq('deleted', false)),
      counts('customers', (q: any) => q.eq('deleted', false)),
      counts('activities', (q: any) => q.eq('deleted', false)),
      counts('orders'),
      counts('stores'),
      counts('profiles', (q: any) => q.eq('disabled', false)),
      counts('subscriptions'),
    ]);

    /* 마지막 접속은 auth 쪽에 있습니다. 회사마다 따로 물어보지 않고
       한 번에 받아 와서 회사별 최댓값을 구합니다. */
    const seen: Record<string, string> = {};
    const { data: people } = await admin.from('profiles').select('id, company_id');

    /* 운영자가 속한 회사는 우리 회사입니다. apps 가 비어 있는 것이 정상이라
       "서비스 없음" 이라는 빨간 딱지를 붙이면 안 됩니다 — 고쳐야 할 것처럼 보입니다. */
    const opsCo = new Set<string>();
    {
      const { data: ops } = await admin.from('operators').select('user_id');
      const cid: Record<string, string> = {};
      for (const p of (people ?? [])) cid[p.id] = p.company_id;
      for (const o of (ops ?? [])) if (cid[o.user_id]) opsCo.add(cid[o.user_id]);
    }
    const byUser: Record<string, string> = {};
    for (const p of (people ?? [])) byUser[p.id] = p.company_id;
    try {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of (users?.users ?? [])) {
        const cid = byUser[u.id];
        const at = u.last_sign_in_at;
        if (!cid || !at) continue;
        if (!seen[cid] || at > seen[cid]) seen[cid] = at;
      }
    } catch { /* 못 받아 와도 나머지는 보여 줍니다 */ }

    return json({
      ok: true,
      companies: (comps ?? []).map((c: any) => ({
        id: c.id, code: c.code, name: c.name,
        apps: Array.isArray(c.apps) ? c.apps : [],
        disabled: !!c.disabled, createdAt: c.created_at,
        use: {
          projects: prj[c.id] ?? 0, customers: cust[c.id] ?? 0, acts: act[c.id] ?? 0,
          orders: ord[c.id] ?? 0, stores: str[c.id] ?? 0,
        },
        users: prof[c.id] ?? 0,
        subs: sub[c.id] ?? 0,
        isOps: opsCo.has(c.id),
        lastSeen: seen[c.id] ?? null,
      })),
    });
  }

  /* ── 회사 하나 자세히 ── */
  if (action === 'company') {
    const id = String(body.id ?? '');
    const { data: c } = await admin.from('companies')
      .select('id, code, name, apps, disabled, created_at').eq('id', id).maybeSingle();
    if (!c) return json({ ok: false, error: '그런 회사가 없습니다.' }, 404);

    const { data: people } = await admin.from('profiles')
      .select('id, login_id, name, role, disabled').eq('company_id', id).order('login_id');

    /* 마지막 접속 — 이 회사 사람만 */
    const seen: Record<string, string | null> = {};
    try {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of (users?.users ?? [])) seen[u.id] = u.last_sign_in_at ?? null;
    } catch { /* 없으면 빈 채로 */ }

    const { data: sub } = await admin.from('subscriptions')
      .select('*').eq('company_id', id).maybeSingle();

    const { data: log } = await admin.from('audit_log')
      .select('action, target, at').eq('company_id', id).order('at', { ascending: false }).limit(20);

    return json({
      ok: true,
      company: {
        id: c.id, code: c.code, name: c.name,
        apps: Array.isArray(c.apps) ? c.apps : [],
        disabled: !!c.disabled, createdAt: c.created_at,
      },
      users: (people ?? []).map((p: any) => ({
        id: p.id, loginId: p.login_id, name: p.name,
        role: p.role, disabled: !!p.disabled, lastSeen: seen[p.id] ?? null,
      })),
      sub: sub ?? null,
      log: log ?? [],
    });
  }

  /* ── 회사 만들기 ──
     setup-admin.sh 가 하던 일을 그대로 합니다. 다만 apps 까지 한 번에 넣습니다 —
     지금까지는 셸로 회사를 만든 뒤 손으로 SQL 을 한 번 더 돌려야 했고,
     그걸 잊으면 만들어 놓고도 아무도 못 들어갔습니다. */
  if (action === 'company-create') {
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    const loginId = String(body.loginId ?? 'admin').trim().toLowerCase();
    const pw = String(body.password ?? '');
    const apps = (Array.isArray(body.apps) ? body.apps : [])
      .map((a: unknown) => String(a)).filter((a: string) => APPS.includes(a as any));

    if (!CODE_RE.test(code)) return json({ ok: false, error: '회사 코드는 영문 대문자와 숫자 4~12자입니다.' }, 400);
    if (!name) return json({ ok: false, error: '회사 이름을 적어 주세요.' }, 400);
    if (!ID_RE.test(loginId)) return json({ ok: false, error: '아이디는 영문 소문자·숫자·-_. 2~32자입니다.' }, 400);
    const bad = checkPw(pw); if (bad) return json({ ok: false, error: bad }, 400);
    if (!apps.length) return json({ ok: false, error: '쓸 서비스를 하나 이상 골라 주세요. 비워 두면 아무 데도 못 들어갑니다.' }, 400);

    const { data: exist } = await admin.from('companies').select('id').eq('code', code).maybeSingle();
    if (exist) return json({ ok: false, error: '이미 있는 회사 코드입니다.' }, 409);

    const { data: comp, error: e1 } = await admin.from('companies')
      .insert({ code, name, apps }).select('id').single();
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
      name: String(body.adminName ?? '관리자').trim() || '관리자', role: 'admin',
    });
    if (e3) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from('companies').delete().eq('id', comp.id);
      return json({ ok: false, error: e3.message }, 500);
    }
    await audit(comp.id, me.id, 'ops.company.create', code, { apps, loginId });
    return json({ ok: true, id: comp.id, code, loginId });
  }

  /* ── 어느 서비스를 쓰나 ──
     화면이 아니라 데이터베이스가 막습니다(company_for_app). 여기서 끄면
     그 회사는 그 서비스의 자료를 **한 줄도 못 읽습니다.** 지우는 것이 아니라
     보이지 않게 되는 것이라, 도로 켜면 그대로 돌아옵니다. */
  if (action === 'company-apps') {
    const id = String(body.id ?? '');
    const apps = (Array.isArray(body.apps) ? body.apps : [])
      .map((a: unknown) => String(a)).filter((a: string) => APPS.includes(a as any));
    const { data: c } = await admin.from('companies').select('code, apps').eq('id', id).maybeSingle();
    if (!c) return json({ ok: false, error: '그런 회사가 없습니다.' }, 404);
    const { error } = await admin.from('companies').update({ apps }).eq('id', id);
    if (error) return json({ ok: false, error: error.message }, 500);
    await audit(id, me.id, 'ops.company.apps', c.code, { before: c.apps, after: apps });
    return json({ ok: true, apps });
  }

  /* ── 회사 통째로 멈추기 ── */
  if (action === 'company-disabled') {
    const id = String(body.id ?? '');
    const off = body.disabled === true;
    const { data: c } = await admin.from('companies').select('code').eq('id', id).maybeSingle();
    if (!c) return json({ ok: false, error: '그런 회사가 없습니다.' }, 404);
    const { error } = await admin.from('companies').update({ disabled: off }).eq('id', id);
    if (error) return json({ ok: false, error: error.message }, 500);
    if (off) {
      // 열려 있던 로그인도 끊습니다. 안 그러면 이미 들어와 있는 사람은 계속 씁니다.
      const { data: people } = await admin.from('profiles').select('id').eq('company_id', id);
      for (const p of (people ?? [])) await admin.auth.admin.signOut(p.id, 'global').catch(() => {});
    }
    await audit(id, me.id, off ? 'ops.company.disable' : 'ops.company.enable', c.code, null);
    return json({ ok: true });
  }

  /* ── 계정 ── */
  if (action === 'user-create') {
    const companyId = String(body.companyId ?? '');
    const loginId = String(body.loginId ?? '').trim().toLowerCase();
    const pw = String(body.password ?? '');
    if (!ID_RE.test(loginId)) return json({ ok: false, error: '아이디는 영문 소문자·숫자·-_. 2~32자입니다.' }, 400);
    const bad = checkPw(pw); if (bad) return json({ ok: false, error: bad }, 400);

    const { data: c } = await admin.from('companies').select('code').eq('id', companyId).maybeSingle();
    if (!c) return json({ ok: false, error: '그런 회사가 없습니다.' }, 404);

    const { data: dup } = await admin.from('profiles')
      .select('id').eq('company_id', companyId).eq('login_id', loginId).maybeSingle();
    if (dup) return json({ ok: false, error: '이미 있는 아이디입니다.' }, 409);

    const { data: created, error } = await admin.auth.admin.createUser({
      email: emailFor(loginId, c.code), password: pw, email_confirm: true,
      user_metadata: { company_code: c.code, login_id: loginId },
    });
    if (error || !created?.user) return json({ ok: false, error: error?.message ?? '실패했습니다.' }, 500);

    const { error: e2 } = await admin.from('profiles').insert({
      id: created.user.id, company_id: companyId, login_id: loginId,
      name: String(body.name ?? loginId).trim() || loginId,
      role: body.role === 'admin' ? 'admin' : 'user',
    });
    if (e2) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ ok: false, error: e2.message }, 500);
    }
    await audit(companyId, me.id, 'ops.user.create', loginId, { role: body.role ?? 'user' });
    return json({ ok: true, loginId });
  }

  if (action === 'user-reset-password') {
    const userId = String(body.userId ?? '');
    const pw = String(body.password ?? '');
    const bad = checkPw(pw); if (bad) return json({ ok: false, error: bad }, 400);
    const { data: t } = await admin.from('profiles')
      .select('company_id, login_id').eq('id', userId).maybeSingle();
    if (!t) return json({ ok: false, error: '그런 계정이 없습니다.' }, 404);
    const { error } = await admin.auth.admin.updateUserById(userId, { password: pw });
    if (error) return json({ ok: false, error: error.message }, 500);
    // 비밀번호를 바꾸면 열려 있던 로그인은 모두 끊습니다
    await admin.auth.admin.signOut(userId, 'global').catch(() => {});
    await audit(t.company_id, me.id, 'ops.user.reset-password', t.login_id, null);
    return json({ ok: true });
  }

  if (action === 'user-disabled') {
    const userId = String(body.userId ?? '');
    const off = body.disabled === true;
    if (userId === me.id) return json({ ok: false, error: '자기 계정은 중지할 수 없습니다.' }, 400);
    const { data: t } = await admin.from('profiles')
      .select('company_id, login_id').eq('id', userId).maybeSingle();
    if (!t) return json({ ok: false, error: '그런 계정이 없습니다.' }, 404);
    await admin.from('profiles').update({ disabled: off }).eq('id', userId);
    if (off) await admin.auth.admin.signOut(userId, 'global').catch(() => {});
    await audit(t.company_id, me.id, off ? 'ops.user.disable' : 'ops.user.enable', t.login_id, null);
    return json({ ok: true });
  }

  /* ── 최근에 무슨 일이 있었나 ── */
  if (action === 'audit') {
    const { data: log } = await admin.from('audit_log')
      .select('company_id, actor_id, action, target, detail, at')
      .order('at', { ascending: false }).limit(100);
    const { data: comps } = await admin.from('companies').select('id, code');
    const { data: people } = await admin.from('profiles').select('id, login_id, name');
    const cm: Record<string, string> = {};
    for (const c of (comps ?? [])) cm[c.id] = c.code;
    const pm: Record<string, string> = {};
    for (const p of (people ?? [])) pm[p.id] = p.name || p.login_id;
    return json({
      ok: true,
      log: (log ?? []).map((r: any) => ({
        code: r.company_id ? (cm[r.company_id] ?? '—') : '—',
        who: r.actor_id ? (pm[r.actor_id] ?? '—') : '—',
        action: r.action, target: r.target, detail: r.detail, at: r.at,
      })),
    });
  }

  return json({ ok: false, error: '알 수 없는 요청입니다: ' + action }, 400);
});
