-- 매달 요금을 걷은 기록 (2026-09-22)
--
-- 왜 표가 따로 필요한가:
--   토스는 정기결제를 대신 돌려 주지 않습니다. "때 되면 이 키로 긁으세요" 일 뿐입니다.
--   그 '긁는 일꾼'을 우리가 돌리는데, 일꾼은 매일 깨어납니다. 같은 달을 두 번
--   긁지 않으려면 "이 회사의 이 기간은 이미 처리했다"를 어딘가 적어 둬야 합니다.
--   그 자리가 여기입니다.
--
--   열쇠는 (company_id, due_on) 입니다. due_on 은 '이 달 요금을 걷기로 한 날',
--   곧 직전 구독 기간의 끝날입니다. 데이터베이스가 중복을 막아 주므로,
--   일꾼이 두 번 돌든 두 대가 동시에 돌든 한 번만 걷힙니다.

create table if not exists public.billing_charges (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,

  due_on        timestamptz not null,          -- 걷기로 한 날 (직전 기간의 끝)
  period_start  timestamptz not null,          -- 이 돈으로 쓰는 기간
  period_end    timestamptz not null,

  amount        integer not null,              -- 원, 부가세 별도
  plan_key      text,
  plan_name     text,
  services      integer,                       -- 그때 쓰던 서비스 개수 (나중에 채웁니다)

  -- planned  걷을 차례라고 적어만 둔 것 (연습 모드에서는 여기서 멈춥니다)
  -- paid     걷었습니다
  -- failed   카드가 거절했습니다. next_try_at 에 다시 해 봅니다
  -- skipped  걷을 것이 없습니다 (0원·해지·협의 요금제)
  status        text not null default 'planned'
                check (status in ('planned','paid','failed','skipped')),

  tries         integer not null default 0,
  next_try_at   timestamptz,
  last_error    text,

  provider      text,
  payment_key   text,                          -- 토스가 준 영수증 열쇠
  order_id      text,                          -- 우리가 만든 주문번호. 한 번만 씁니다
  charged_at    timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint billing_charges_once unique (company_id, due_on)
);

create index if not exists billing_charges_company_idx on public.billing_charges (company_id, due_on desc);
create index if not exists billing_charges_todo_idx    on public.billing_charges (status, next_try_at);

drop trigger if exists billing_charges_touch on public.billing_charges;
create trigger billing_charges_touch before update on public.billing_charges
  for each row execute function public.touch_updated_at();

-- ── 권한 ──
-- subscriptions 에서 겪은 일을 되풀이하지 않습니다. RLS 정책만 만들어 두고
-- 권한을 안 주면 정책은 쓰이지도 못합니다. 둘 다 해 둡니다.
--
--   service_role  — 일꾼이 읽고 씁니다. RLS 를 건너뜁니다
--   authenticated — 제 회사 청구 내역만 읽기. 카드 정보는 여기 없습니다

alter table public.billing_charges enable row level security;

drop policy if exists billing_charges_read on public.billing_charges;
create policy billing_charges_read on public.billing_charges
  for select to authenticated
  using (company_id = current_company_id());

grant select, insert, update, delete on public.billing_charges to service_role;
grant select                        on public.billing_charges to authenticated;

notify pgrst, 'reload schema';
