// 고객사 공개 링크 — 로그인하지 않은 사람에게 프로젝트 하나를 읽어 줍니다.
//
// 로그인하지 않은 사람(anon)에게는 데이터베이스 권한이 하나도 없습니다.
// 대신 이 함수가 토큰을 확인한 뒤 service_role 로 대신 읽어 돌려줍니다.
// 그래서 토큰이 곧 열쇠이고, 이 함수가 문지기입니다.
//
// 돌려주는 것은 고객사가 봐야 할 것뿐입니다.
// 내부 메모·담당자 id·다른 프로젝트는 나가지 않습니다.
//
// 배포:
//   supabase functions deploy share-view --no-verify-jwt --project-ref izrtclsqhsgkuwsffifn
//   (--no-verify-jwt 를 빼면 고객사가 열 수 없습니다)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { mkJson } from '../_shared/cors.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const TOKEN_RE = /^[a-f0-9]{32,64}$/;
const PHOTO_TTL = 60 * 60;          // 사진 주소는 한 시간만 삽니다

// 몰래 대입해 보는 것을 늦춥니다. 서버 한 대 안에서만 세는 것이라
// 완벽하지는 않지만, 토큰이 32자 이상이라 실제로는 이것으로 충분합니다.
const hits = new Map<string, { n: number; at: number }>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now - cur.at > 60_000) { hits.set(ip, { n: 1, at: now }); return false; }
  cur.n++;
  if (hits.size > 5000) hits.clear();
  return cur.n > 60;
}

Deno.serve(async (req) => {
  const { cors, json } = mkJson(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 만 받습니다.' }, 405);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (tooMany(ip)) return json({ ok: false, error: '잠시 뒤에 다시 열어 주세요.' }, 429);

  let body: { token?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: '잘못된 요청입니다.' }, 400); }

  const token = String(body.token ?? '').trim().toLowerCase();
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: '없는 주소입니다.' }, 404);

  const { data: p } = await admin
    .from('projects')
    .select('id, company_id, owner_id, name, code, client_company, client_person, ' +
            'qty, unit, spec_size, spec_pages, spec_color, spec_paper, spec_bind, spec_finish, ' +
            'options, unit_price, vat_rate, extra_items, status, started_on, due_on, done_on, ' +
            'photos, share_on, deleted, updated_at')
    .eq('share_token', token)
    .maybeSingle();

  // 없는 토큰과 꺼 둔 링크를 같은 말로 돌려줍니다. 있는지 없는지도 알려 주지 않습니다.
  if (!p || p.deleted || !p.share_on) return json({ ok: false, error: '없는 주소입니다.' }, 404);

  const [{ data: steps }, { data: co }, { data: cs }, { data: owner }] = await Promise.all([
    admin.from('project_steps')
      .select('id, name, percent, at, note, photo_path, created_at')
      .eq('project_id', p.id).eq('deleted', false)
      .order('at', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('companies').select('name').eq('id', p.company_id).maybeSingle(),
    admin.from('company_settings').select('biz_no, ceo, addr, biz_type, biz_item, tel, fax, bank, note')
      .eq('company_id', p.company_id).maybeSingle(),
    admin.from('profiles').select('name').eq('id', p.owner_id).maybeSingle(),
  ]);

  // 사진 주소는 한시적으로 만들어 줍니다. 보관함 자체는 계속 잠겨 있습니다.
  async function sign(path: string | null | undefined) {
    if (!path) return null;
    if (!path.startsWith(p.company_id + '/')) return null;   // 다른 회사 폴더는 절대 서명하지 않습니다
    const { data } = await admin.storage.from('works').createSignedUrl(path, PHOTO_TTL);
    return data?.signedUrl ?? null;
  }

  const photos = (await Promise.all((p.photos ?? []).map(sign))).filter(Boolean);
  const stepList = await Promise.all((steps ?? []).map(async (s) => ({
    id: s.id, name: s.name, percent: s.percent, at: s.at, note: s.note,
    photo: await sign(s.photo_path),
  })));

  return json({
    ok: true,
    now: new Date().toISOString(),
    maker: {                                   // 만드는 쪽 (제조사)
      name: co?.name ?? '',
      person: owner?.name ?? '',
      bizNo: cs?.biz_no ?? '', ceo: cs?.ceo ?? '', addr: cs?.addr ?? '',
      bizType: cs?.biz_type ?? '', bizItem: cs?.biz_item ?? '',
      tel: cs?.tel ?? '', fax: cs?.fax ?? '', bank: cs?.bank ?? '', note: cs?.note ?? '',
    },
    project: {
      name: p.name, code: p.code,
      clientCompany: p.client_company, clientPerson: p.client_person,
      qty: p.qty, unit: p.unit,
      specSize: p.spec_size, specPages: p.spec_pages, specColor: p.spec_color,
      specPaper: p.spec_paper, specBind: p.spec_bind, specFinish: p.spec_finish,
      options: p.options ?? [],
      unitPrice: Number(p.unit_price ?? 0), vatRate: Number(p.vat_rate ?? 10),
      extraItems: p.extra_items ?? [],
      status: p.status, startedOn: p.started_on, dueOn: p.due_on, doneOn: p.done_on,
      photos, updatedAt: p.updated_at,
    },
    steps: stepList,
  });
});
