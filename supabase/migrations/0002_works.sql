-- ═══════════════════════════════════════════════════════════════
-- Re:Bind — 제조 공정 · 거래명세서
--
-- Re:Call(고객관리)과 같은 데이터베이스, 같은 계정을 씁니다.
-- 회사 격리·담당자 규칙은 0001 에서 만든 도우미 함수를 그대로 씁니다.
--
-- 설계 원칙 (0001 과 같습니다)
--   1) 회사 격리는 앱이 아니라 데이터베이스가 강제합니다.
--   2) 지운 것은 표시만 합니다.
--   3) 고객사 공개 링크는 이 표를 직접 열지 않습니다.
--      로그인하지 않은 사람에게는 어떤 권한도 주지 않고,
--      서버 함수(share-view)가 토큰을 확인한 뒤 대신 읽어 줍니다.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────── 공급자 정보 (명세서 머리글) ─────────────────
-- 회사마다 한 줄. 거래명세서 왼쪽 "공급자" 칸에 그대로 들어갑니다.
create table public.company_settings (
  company_id  uuid primary key references public.companies(id) on delete cascade,
  biz_no      text not null default '',   -- 사업자등록번호
  ceo         text not null default '',   -- 대표자
  addr        text not null default '',   -- 사업장 주소
  biz_type    text not null default '',   -- 업태
  biz_item    text not null default '',   -- 종목
  tel         text not null default '',
  fax         text not null default '',
  bank        text not null default '',   -- 입금 계좌
  note        text not null default '',   -- 명세서 하단 안내문
  vat_rate    numeric(5,2) not null default 10,
  updated_at  timestamptz not null default now()
);

-- ───────────────── 제조 프로젝트 ─────────────────
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete restrict,
  owner_id       uuid not null references public.profiles(id) on delete restrict,
  shared_ids     uuid[] not null default '{}',
  -- Re:Call 의 고객카드와 이어 두면 담당자 정보가 따라옵니다 (선택)
  customer_id    uuid references public.customers(id) on delete set null,

  name           text not null default '',   -- 프로젝트명
  code           text not null default '',   -- 발주번호 · 사내 관리번호
  client_company text not null default '',   -- 고객사
  client_person  text not null default '',   -- 담당자
  client_phone   text not null default '',
  client_email   text not null default '',

  -- 제조 상품 상세
  qty            integer not null default 0, -- 총 제작수량
  unit           text    not null default '부',
  spec_size      text    not null default '', -- 규격
  spec_pages     integer,                     -- 면수
  spec_color     text    not null default '', -- 색상 · 도수
  spec_paper     text    not null default '', -- 용지
  spec_bind      text    not null default '', -- 제본 방식
  spec_finish    text    not null default '', -- 후가공
  options        jsonb   not null default '[]'::jsonb,  -- [{label,value}] 자유 항목

  -- 금액
  unit_price     numeric(14,2) not null default 0,
  vat_rate       numeric(5,2)  not null default 10,
  extra_items    jsonb not null default '[]'::jsonb,    -- [{name,spec,qty,price}]

  status         text not null default 'ready',         -- ready·running·done·hold
  started_on     date,
  due_on         date,
  done_on        date,

  photos         text[] not null default '{}',          -- 완성본 사진 경로
  memo           text   not null default '',

  -- 고객사 공개 링크
  share_token    text unique,
  share_on       boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted        boolean not null default false,

  constraint projects_named    check (length(name) > 0 or length(client_company) > 0),
  constraint projects_status   check (status in ('ready','running','done','hold')),
  constraint projects_qty      check (qty >= 0),
  constraint projects_token_fmt check (share_token is null or share_token ~ '^[a-f0-9]{32,64}$')
);
create index projects_company_idx on public.projects(company_id) where not deleted;
create index projects_owner_idx   on public.projects(company_id, owner_id) where not deleted;
create index projects_shared_idx  on public.projects using gin (shared_ids);
create index projects_updated_idx on public.projects(company_id, updated_at);
create index projects_due_idx     on public.projects(company_id, due_on) where not deleted and status <> 'done';
create index projects_token_idx   on public.projects(share_token) where share_on and not deleted;

-- ───────────────── 공정 기록 (타임라인) ─────────────────
create table public.project_steps (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete restrict,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null default '',      -- 공정명
  percent     integer not null default 0,    -- 전체 공정에서 여기까지 몇 %
  at          date not null default current_date,
  note        text not null default '',
  photo_path  text,
  by_id       uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  constraint steps_percent_chk check (percent between 0 and 100)
);
create index steps_project_idx on public.project_steps(project_id, at) where not deleted;
create index steps_company_idx on public.project_steps(company_id, updated_at);
create index steps_day_idx     on public.project_steps(company_id, at) where not deleted;

-- ───────────────── 수정시각 자동 갱신 ─────────────────
create trigger projects_touch      before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger steps_touch         before update on public.project_steps
  for each row execute function public.touch_updated_at();
create trigger cosettings_touch    before update on public.company_settings
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 행 단위 접근 제어
-- 0001 과 같은 뼈대입니다. 기본은 "아무것도 안 보임" 입니다.
-- ═══════════════════════════════════════════════════════════════
alter table public.company_settings enable row level security;
alter table public.projects         enable row level security;
alter table public.project_steps    enable row level security;

alter table public.company_settings force row level security;
alter table public.projects         force row level security;
alter table public.project_steps    force row level security;

-- ── 공급자 정보: 회사 사람이면 봅니다. 고치는 것은 관리자만. ──
create policy cosettings_read on public.company_settings
  for select to authenticated
  using (company_id = public.current_company_id());

create policy cosettings_insert on public.company_settings
  for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_admin());

create policy cosettings_update on public.company_settings
  for update to authenticated
  using  (company_id = public.current_company_id() and public.is_admin())
  with check (company_id = public.current_company_id());

-- ── 프로젝트: 같은 회사 + (관리자거나 · 담당이거나 · 공유받았거나) ──
create policy projects_read on public.projects
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin() or owner_id = auth.uid() or auth.uid() = any(shared_ids))
  );

create policy projects_insert on public.projects
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

create policy projects_update on public.projects
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

create policy projects_delete on public.projects
  for delete to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ── 공정 기록: 그 프로젝트가 보이면 기록도 보입니다 ──
create policy steps_read on public.project_steps
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and exists (select 1 from public.projects p where p.id = project_id)
  );

create policy steps_insert on public.project_steps
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (select 1 from public.projects p
                 where p.id = project_id and p.company_id = public.current_company_id())
  );

create policy steps_update on public.project_steps
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and exists (select 1 from public.projects p where p.id = project_id)
  )
  with check (company_id = public.current_company_id());

create policy steps_delete on public.project_steps
  for delete to authenticated
  using (company_id = public.current_company_id() and public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 완성본 · 공정 사진 보관함
-- 경로 규칙: {회사id}/{프로젝트id}/{사진id}.jpg
-- 폴더 이름이 곧 접근 권한입니다. (0001 의 cards 와 같은 방식)
-- 고객사에게는 서버 함수가 만든 한시적 주소만 나갑니다.
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('works', 'works', false)
on conflict (id) do nothing;

create policy works_read on storage.objects
  for select to authenticated
  using (bucket_id = 'works'
         and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy works_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'works'
         and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy works_update on storage.objects
  for update to authenticated
  using (bucket_id = 'works'
         and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy works_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'works'
         and (storage.foldername(name))[1] = public.current_company_id()::text);

-- ═══════════════════════════════════════════════════════════════
-- 표 권한
-- "새 표 자동 노출"이 꺼져 있으므로 여기에 적지 않으면 아무도 못 읽습니다.
-- 로그인하지 않은 사람(anon)에게는 아무것도 주지 않습니다.
-- ═══════════════════════════════════════════════════════════════
grant select, insert, update          on public.company_settings to authenticated;
grant select, insert, update, delete  on public.projects         to authenticated;
grant select, insert, update, delete  on public.project_steps    to authenticated;

grant all privileges on public.company_settings to service_role;
grant all privileges on public.projects         to service_role;
grant all privileges on public.project_steps    to service_role;
