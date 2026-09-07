-- ═══════════════════════════════════════════════════════════════
-- 홈페이지(dnalabs.kr)를 운영 화면에서 다루기 위한 표 넷
--
-- 지금까지 홈페이지는 "고칠 때마다 코드를 고쳐 올리는" 물건이었습니다.
-- 문의는 mailto 라 기록이 아예 없었고, 몇 명이 보고 갔는지도 몰랐습니다.
--
-- 네 표 모두 **ops 함수만** 만집니다(operators 와 같은 방식).
-- 브라우저에서 직접 닿는 곳은 문의 넣기 하나뿐이고, 그것도 함수를 거칩니다.
-- ═══════════════════════════════════════════════════════════════

-- ── ① 문의 ──
-- ⚠ 개인정보가 들어옵니다. 그래서 두 가지를 표에 못 박아 둡니다.
--    agreed_at  — 동의 없이 들어온 줄은 아예 만들 수 없습니다(not null).
--    purge_on   — 언제 지울지를 넣을 때 함께 정합니다. "언젠가 지우겠다" 는
--                 지켜지지 않습니다. 처리방침에 적은 보관기간과 같은 값입니다.
create table if not exists public.site_inquiries (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  name       text not null default '',
  company    text not null default '',
  contact    text not null default '',          -- 메일 또는 전화. 하나는 반드시
  want       text not null default '',          -- 관심 서비스 (rebind/recall/restore/etc)
  people     text not null default '',          -- 쓸 인원 (자유 입력)
  message    text not null default '',
  source     text not null default '',          -- 어느 쪽에서 눌렀나
  status     text not null default 'new',       -- new · read · replied · closed
  memo       text not null default '',          -- 우리끼리 남기는 말. 문의한 분께 안 보입니다
  agreed_at  timestamptz not null,              -- 개인정보 수집 동의 시각
  purge_on   date not null,                     -- 이 날 지웁니다
  constraint site_inq_status_chk check (status in ('new','read','replied','closed'))
);
create index if not exists site_inq_at_idx     on public.site_inquiries(at desc);
create index if not exists site_inq_status_idx on public.site_inquiries(status, at desc);
create index if not exists site_inq_purge_idx  on public.site_inquiries(purge_on);

-- ── ② 방문 ──
-- 날짜 × 경로별 **숫자만** 셉니다. 누가 왔는지는 담지 않습니다 —
-- IP·쿠키·기기표시를 안 남기므로 개인정보가 아니고, 그래서 동의창이 필요 없습니다.
-- 사람 수가 아니라 열어 본 횟수입니다. 그 이상을 알려면 개인정보를 모아야 하는데,
-- 홈페이지 통계를 보자고 그럴 이유가 없습니다.
create table if not exists public.site_hits (
  day  date not null,
  path text not null,
  n    integer not null default 0,
  primary key (day, path)
);

-- ── ③ 홈페이지 글 덮어쓰기 ──
-- HTML 에 박힌 글을 그대로 두고, 여기 값이 있으면 그것으로 갈아 끼웁니다.
-- ⚠ 검색엔진은 HTML 을 봅니다. 여기서 고친 글은 사람에게만 보입니다.
--    그래서 "급할 때 고치는 자리" 이지 원본이 아닙니다. 자세한 것은 RECALL.md.
create table if not exists public.site_copy (
  key        text primary key,               -- 예: index.hero.title
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- ── ④ 요금제·업종 ──
-- catalog.json 이 단일 출처인 것은 그대로 둡니다. 여기에는 **화면에서 고친 것**만
-- 담고, 내보낼 때 catalog.json 을 다시 만들어 올립니다.
-- 값이 두 군데가 되면 결제 사고가 나므로, 운영 화면은 "여기가 최신인지" 를
-- 늘 함께 보여 줘야 합니다(ops 가 json 을 비교해 알려 줍니다).
create table if not exists public.site_catalog (
  id         integer primary key default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint site_catalog_one_row check (id = 1)
);

-- ── 접근 규칙 ──
-- 넷 다 정책을 만들지 않습니다 = 브라우저에서는 아무것도 못 합니다.
-- operators 와 같은 판단입니다(ops_0001). service_role 만 지나갑니다.
do $$
declare t text;
begin
  foreach t in array array['site_inquiries','site_hits','site_copy','site_catalog'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all privileges on public.%I to service_role', t);
  end loop;
end $$;

comment on table public.site_inquiries is
  '홈페이지 문의. 개인정보가 들어 있습니다 — agreed_at 없이는 못 넣고, purge_on 날 지웁니다.';
comment on table public.site_hits is
  '홈페이지 방문 — 날짜×경로별 횟수만. 누가 왔는지는 담지 않습니다(개인정보 아님).';
comment on table public.site_copy is
  '홈페이지 글 덮어쓰기. ⚠ 검색엔진은 HTML 원본을 봅니다 — 여기 값은 사람에게만 보입니다.';
comment on table public.site_catalog is
  '요금제·업종. catalog.json 이 단일 출처이고 여기는 화면에서 고친 사본입니다.';

-- ── 방문 세기 ──
-- 한 문장으로 올려야 동시에 여러 명이 들어와도 안 샙니다.
create or replace function public.site_hit(p_path text)
returns void language sql security definer set search_path = public as $$
  insert into public.site_hits (day, path, n)
       values (current_date, left(p_path, 120), 1)
  on conflict (day, path) do update set n = public.site_hits.n + 1;
$$;
revoke all on function public.site_hit(text) from anon, authenticated, public;
grant execute on function public.site_hit(text) to service_role;

-- ── 지날 때가 된 문의 지우기 ──
-- 따로 청소하는 일을 만들지 않고, 운영 화면이 열릴 때 지나는 길에 치웁니다.
create or replace function public.site_purge()
returns integer language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  delete from public.site_inquiries where purge_on < current_date;
  get diagnostics c = row_count;
  -- 방문 기록은 2년만 둡니다. 그 이상은 볼 일이 없습니다.
  delete from public.site_hits where day < current_date - interval '2 years';
  return c;
end $$;
revoke all on function public.site_purge() from anon, authenticated, public;
grant execute on function public.site_purge() to service_role;
