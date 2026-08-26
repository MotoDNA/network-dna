-- ═══════════════════════════════════════════════════════════════
-- NETWORK DNA 고객관리 — 데이터베이스 초기 설치
--
-- 설계 원칙
--   1) 회사 격리는 애플리케이션이 아니라 데이터베이스가 강제합니다.
--      앱에 버그가 있어도 다른 회사 데이터는 나오지 않습니다.
--   2) 비밀번호는 Supabase Auth 가 관리합니다. 직접 만들지 않습니다.
--   3) 지운 것은 실제로 지우지 않고 표시만 합니다(동기화 때문).
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ───────────────── 회사 ─────────────────
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null default '',
  note        text not null default '',
  disabled    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint companies_code_fmt check (code ~ '^[A-Z0-9]{4,12}$')
);

-- ───────────────── 사용자 프로필 ─────────────────
-- auth.users 는 Supabase 가 관리합니다. 여기에는 회사·아이디·권한만 둡니다.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete restrict,
  login_id    text not null,
  name        text not null default '',
  role        text not null default 'user',
  disabled    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_role_chk check (role in ('admin','user')),
  constraint profiles_login_fmt check (login_id ~ '^[a-z0-9._-]{2,32}$'),
  unique (company_id, login_id)
);
create index profiles_company_idx on public.profiles(company_id) where not disabled;

-- ───────────────── 고객 ─────────────────
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete restrict,
  owner_id     uuid not null references public.profiles(id) on delete restrict,
  shared_ids   uuid[] not null default '{}',
  name         text not null default '',
  company_name text not null default '',
  title        text not null default '',
  phone        text not null default '',
  phone_digits text generated always as (regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')) stored,
  email        text not null default '',
  addr         text not null default '',
  groups       text[] not null default '{}',
  photo_path   text,
  last_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,
  constraint customers_named check (length(name) > 0 or length(company_name) > 0)
);
create index customers_company_idx  on public.customers(company_id) where not deleted;
create index customers_owner_idx    on public.customers(company_id, owner_id) where not deleted;
create index customers_shared_idx   on public.customers using gin (shared_ids);
create index customers_groups_idx   on public.customers using gin (groups);
create index customers_updated_idx  on public.customers(company_id, updated_at);
create index customers_phone_idx    on public.customers(company_id, phone_digits);

-- ───────────────── 타임라인 ─────────────────
create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete restrict,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  kind         text not null default 'meeting',
  body         text not null default '',
  at           timestamptz not null default now(),
  due          date,
  done         boolean not null default false,
  by_id        uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted      boolean not null default false,
  constraint activities_kind_chk check (kind in ('meeting','request','issue','note','sample','todo'))
);
create index activities_customer_idx on public.activities(customer_id) where not deleted;
create index activities_company_idx  on public.activities(company_id, updated_at);
create index activities_todo_idx     on public.activities(company_id, due) where kind='todo' and not done and not deleted;

-- ───────────────── 감사 기록 ─────────────────
create table public.audit_log (
  id         bigserial primary key,
  company_id uuid,
  actor_id   uuid,
  action     text not null,
  target     text,
  detail     jsonb,
  at         timestamptz not null default now()
);
create index audit_company_idx on public.audit_log(company_id, at desc);

-- ═══════════════════════════════════════════════════════════════
-- 지금 로그인한 사람이 누구인가 — 정책에서 쓰는 도우미
--
-- security definer 로 두는 이유: profiles 정책 안에서 profiles 를
-- 다시 읽으면 무한 재귀가 납니다. 이 함수는 정책을 우회해 읽습니다.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.company_id
    from public.profiles p
    join public.companies c on c.id = p.company_id
   where p.id = auth.uid() and not p.disabled and not c.disabled
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.role = 'admin'
                     from public.profiles p
                    where p.id = auth.uid() and not p.disabled), false)
$$;

revoke all on function public.current_company_id() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ───────────────── 수정시각 자동 갱신 ─────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger customers_touch  before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger activities_touch before update on public.activities
  for each row execute function public.touch_updated_at();
create trigger profiles_touch   before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 행 단위 접근 제어 (RLS)
--
-- 여기서 막지 못하면 어디서도 못 막습니다.
-- 모든 표에서 기본은 "아무것도 안 보임"이고, 아래 정책이 허용하는
-- 것만 보입니다. service_role(서버 함수)만 이 규칙을 건너뜁니다.
-- ═══════════════════════════════════════════════════════════════
alter table public.companies  enable row level security;
alter table public.profiles   enable row level security;
alter table public.customers  enable row level security;
alter table public.activities enable row level security;
alter table public.audit_log  enable row level security;

alter table public.companies  force row level security;
alter table public.profiles   force row level security;
alter table public.customers  force row level security;
alter table public.activities force row level security;
alter table public.audit_log  force row level security;

-- ── 회사: 내 회사만, 읽기만 ──
create policy companies_read on public.companies
  for select to authenticated
  using (id = public.current_company_id());

-- ── 프로필: 같은 회사 사람만 보입니다 ──
create policy profiles_read on public.profiles
  for select to authenticated
  using (company_id = public.current_company_id());

-- 이름은 본인만 고칠 수 있습니다. 회사·권한·아이디는 못 바꿉니다.
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and company_id = public.current_company_id()
    and role     = (select role     from public.profiles p where p.id = auth.uid())
    and login_id = (select login_id from public.profiles p where p.id = auth.uid())
    and disabled = false
  );

-- ── 고객 ──
-- 볼 수 있는 조건: 같은 회사 + (관리자거나 · 담당이거나 · 공유받았거나)
create policy customers_read on public.customers
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin() or owner_id = auth.uid() or auth.uid() = any(shared_ids))
  );

-- 만들 때: 내 회사에만, 담당자는 나 (관리자는 같은 회사 누구든 지정 가능)
create policy customers_insert on public.customers
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and (
      owner_id = auth.uid()
      or (public.is_admin() and exists (
            select 1 from public.profiles p
             where p.id = owner_id and p.company_id = public.current_company_id()))
    )
  );

-- 고칠 때: 볼 수 있는 것만. 회사는 못 옮기고, 담당자는 같은 회사 사람이어야 합니다.
create policy customers_update on public.customers
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin() or owner_id = auth.uid() or auth.uid() = any(shared_ids))
  )
  with check (
    company_id = public.current_company_id()
    and exists (select 1 from public.profiles p
                 where p.id = owner_id and p.company_id = public.current_company_id())
  );

-- 진짜 삭제는 관리자만. 보통은 deleted 를 켜는 것으로 끝냅니다.
create policy customers_delete on public.customers
  for delete to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ── 타임라인: 그 고객이 보이면 기록도 보입니다 ──
-- (아래 exists 안의 customers 조회에도 위 정책이 그대로 적용됩니다)
create policy activities_read on public.activities
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and exists (select 1 from public.customers c where c.id = customer_id)
  );

create policy activities_insert on public.activities
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (select 1 from public.customers c
                 where c.id = customer_id and c.company_id = public.current_company_id())
  );

create policy activities_update on public.activities
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and exists (select 1 from public.customers c where c.id = customer_id)
  )
  with check (company_id = public.current_company_id());

create policy activities_delete on public.activities
  for delete to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ── 감사 기록: 관리자만 읽습니다. 쓰기는 서버 함수만 합니다. ──
create policy audit_read on public.audit_log
  for select to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 명함 사진 보관함
-- 경로 규칙: {회사id}/{고객id}.jpg — 폴더 이름이 곧 접근 권한입니다.
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('cards', 'cards', false)
on conflict (id) do nothing;

create policy cards_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cards'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy cards_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cards'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy cards_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cards'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy cards_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cards'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ═══════════════════════════════════════════════════════════════
-- 로그인 화면이 회사 코드를 확인할 때 쓰는 함수
-- 로그인 전이라 아무 권한이 없으므로, 존재 여부만 알려 줍니다.
-- (회사명까지 알려 주면 코드 대입 공격에 힌트가 됩니다)
-- ═══════════════════════════════════════════════════════════════
create or replace function public.company_exists(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies
                  where code = upper(trim(p_code)) and not disabled)
$$;
revoke all on function public.company_exists(text) from public;
grant execute on function public.company_exists(text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 표 권한
--
-- 프로젝트를 만들 때 "새 표 자동 노출"을 껐습니다.
-- 그래서 어떤 표를 어디까지 열지 여기서 하나하나 적습니다.
-- 권한을 줘도 위의 행 단위 규칙은 그대로 적용됩니다.
-- (권한 = 문을 여는 것, 규칙 = 문 안에서 볼 수 있는 범위)
-- ═══════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated;

-- 로그인하지 않은 상태에서 할 수 있는 일은 회사 코드 확인뿐입니다
-- (company_exists 함수는 위에서 이미 anon 에게 열어 두었습니다)

grant select                          on public.companies  to authenticated;
grant select, update                  on public.profiles   to authenticated;
grant select, insert, update, delete  on public.customers  to authenticated;
grant select, insert, update, delete  on public.activities to authenticated;
grant select                          on public.audit_log  to authenticated;

-- 감사 기록은 서버 함수(service_role)만 씁니다. 사용자에게 insert 를 주지 않습니다.

-- 서버 함수(계정 관리·명함 인식)가 쓰는 역할입니다.
-- 이 역할은 행 단위 규칙을 건너뛰지만, 표 권한은 따로 줘야 합니다.
-- "새 표 자동 노출"을 껐으므로 여기에 적지 않으면 서버 함수가 아무것도 못 합니다.
grant usage on schema public to service_role;
grant all privileges on public.companies  to service_role;
grant all privileges on public.profiles   to service_role;
grant all privileges on public.customers  to service_role;
grant all privileges on public.activities to service_role;
grant all privileges on public.audit_log  to service_role;
grant usage, select on all sequences in schema public to service_role;
