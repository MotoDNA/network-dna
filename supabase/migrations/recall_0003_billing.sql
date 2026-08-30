-- ═══════════════════════════════════════════════════════════════
-- 유료 전환 — 구독 · 좌석 제한 · 회사코드 자동발급
--
-- 여기에 요금이나 요금제 이름을 적지 않은 것은 의도한 것입니다.
-- 금액과 인원 구간은 catalog.json 한 군데에만 있고,
-- 데이터베이스는 "이 회사가 자리를 몇 개 샀는가"(seat_limit)만 압니다.
--
-- 그래야 요금을 고칠 때 SQL 을 건드릴 일이 없고,
-- 화면과 서버와 DB 의 숫자가 어긋나는 일도 생기지 않습니다.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────── 회사에 업종을 남깁니다 ─────────────────
-- 가입 때 무엇을 골랐는지 남겨 둡니다. 나중에 "이 회사는 왜 받았나"를
-- 설명해야 할 때 근거가 됩니다. B 등급은 조건 동의를 함께 받았습니다.
alter table public.companies
  add column if not exists industry_id    text,
  add column if not exists industry_grade text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_industry_grade_chk') then
    alter table public.companies
      add constraint companies_industry_grade_chk
      check (industry_grade is null or industry_grade in ('A','B'));
  end if;
end $$;
-- C 등급은 애초에 가입이 막히므로 값이 들어올 일이 없습니다.
-- 혹시 서버 검사를 빠져나가더라도 여기서 한 번 더 걸립니다.



-- ───────────────── 가입한 사람의 연락처 ─────────────────
-- 청구서를 보내고, 무료체험을 반복해서 받아 가는 것을 막는 데 씁니다.
alter table public.companies
  add column if not exists contact_name  text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

-- 같은 메일로 무료체험을 여러 번 받지 못하게 합니다.
-- 이름이 아니라 메일로 거는 것은, 회사명은 얼마든지 바꿔 쓸 수 있어서입니다.
create unique index if not exists companies_contact_email_uidx
  on public.companies(lower(contact_email))
  where contact_email is not null;


-- ───────────────── 가입 시도 제한 ─────────────────
-- 가입은 로그인 없이 부를 수 있는 유일한 창구라 막아 둡니다.
-- 실제 PG 를 붙이면 카드 없이는 진행되지 않아 자연히 걸러지지만,
-- 그 앞단에서 계정이 무더기로 만들어지는 것을 두고 볼 이유는 없습니다.
create table if not exists public.signup_attempts (
  id         bigserial primary key,
  ip         text not null,
  email      text,
  ok         boolean not null default false,
  reason     text,
  at         timestamptz not null default now()
);
create index if not exists signup_attempts_ip_idx on public.signup_attempts(ip, at desc);

alter table public.signup_attempts enable row level security;
-- 정책 없음 → 서버 함수만 씁니다.

-- 최근 한 시간에 이 주소에서 몇 번 시도했는지
create or replace function public.signup_attempts_recent(p_ip text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.signup_attempts
   where ip = p_ip and at > now() - interval '1 hour'
$$;
revoke all on function public.signup_attempts_recent(text) from public;
grant execute on function public.signup_attempts_recent(text) to service_role;

-- ───────────────── 구독 ─────────────────
-- 회사당 하나입니다. 요금제를 바꾸면 이 줄을 고칩니다.
create table if not exists public.subscriptions (
  company_id     uuid primary key references public.companies(id) on delete cascade,
  plan_key       text not null,               -- catalog.json 의 열쇠말 (personal · business5 …)
  -- 판 시점의 이름과 금액을 그대로 박아 둡니다.
  -- catalog.json 을 보면 되지 않느냐 싶지만, 요금은 나중에 바뀝니다.
  -- 그때 이 회사에 무엇을 얼마에 팔았는지가 남아 있어야
  -- 청구서가 정직해지고, 요금 인상 고지도 이 값을 기준으로 합니다.
  plan_name      text not null default '',
  price          int  not null default 0,     -- 원(KRW) 월 단가. 부가세 별도
  seat_limit     int,                         -- 만들 수 있는 계정 수. null 이면 제한 없음(Enterprise)
  status         text not null default 'trialing',
  trial_ends_at  timestamptz,                 -- 무료 기간이 끝나는 때. 없으면 무료 기간 없음
  period_start   timestamptz not null default now(),
  period_end     timestamptz,                 -- 다음 결제일
  canceled_at    timestamptz,

  -- 하위 요금제로 내리는 것은 다음 결제일부터 적용됩니다(환불정책 제5조).
  -- 그때까지 "무엇으로 바뀔 예정인가"를 여기에 담아 둡니다.
  -- 예약이 걸려 있어도 지금 요금제는 그대로 돌아갑니다.
  pending_plan_key   text,
  pending_plan_name  text,
  pending_price      int,
  pending_seat_limit int,
  pending_from       timestamptz,          -- 적용 시점 = 그때의 period_end

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint subscriptions_status_chk
    check (status in ('trialing','active','past_due','canceled')),
  constraint subscriptions_seat_chk
    check (seat_limit is null or seat_limit >= 1)
);

create index if not exists subscriptions_status_idx
  on public.subscriptions(status, period_end);

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();


-- ───────────────── 결제 수단 ─────────────────
-- 카드번호는 여기에도 없습니다. 결제대행사에서 받은 열쇠값만 둡니다.
-- 이 값이 있으면 다음 달 요금을 청구할 수 있으므로,
-- 아래에서 RLS 를 켜고 정책을 하나도 만들지 않습니다.
-- 정책이 없으면 로그인한 사용자는 한 줄도 볼 수 없고,
-- 서버 함수(service_role)만 다룰 수 있습니다.
create table if not exists public.billing_methods (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  provider     text not null,                 -- 'toss' · 'portone' · 'stub'
  billing_key  text not null,
  customer_key text,
  card_brand   text,
  card_last4   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint billing_last4_fmt check (card_last4 is null or card_last4 ~ '^[0-9]{4}$')
);

drop trigger if exists billing_touch on public.billing_methods;
create trigger billing_touch before update on public.billing_methods
  for each row execute function public.touch_updated_at();


-- ───────────────── 회사코드 6자리 ─────────────────
-- 100000~999999 에서 뽑습니다. 앞자리 0 을 쓰지 않는 이유는
-- 사람이 옮겨 적을 때 빠뜨리기 때문입니다.
-- companies_code_fmt (^[A-Z0-9]{4,12}$) 를 그대로 만족합니다.
create or replace function public.gen_company_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  c text;
  n int := 0;
begin
  loop
    c := (100000 + floor(random() * 900000))::int::text;
    exit when not exists (select 1 from public.companies where code = c);
    n := n + 1;
    if n > 200 then
      raise exception '회사코드를 뽑지 못했습니다. 6자리가 거의 다 찼습니다.';
    end if;
  end loop;
  return c;
end $$;

revoke all on function public.gen_company_code() from public;
grant execute on function public.gen_company_code() to service_role;
-- 서버 함수(service_role)만 부릅니다. 로그인한 사용자에게는 주지 않습니다.



-- ───────────────── 예약된 요금제 변경 적용 ─────────────────
-- 하위 요금제 예약이 걸린 구독 중 적용 시점이 지난 것을 실제로 바꿉니다.
--
-- ⚠ 이 함수를 주기적으로 불러 주는 것이 아직 없습니다.
--   지금은 앱이 구독 정보를 읽을 때 서버 함수가 한 번 불러 줍니다.
--   매월 요금을 걷는 작업을 만들 때, 걷기 **전에** 반드시 이것을 먼저 부르세요.
--   순서가 바뀌면 내려 달라고 한 사람에게 옛 금액을 청구하게 됩니다.
create or replace function public.apply_due_plan_changes()
returns int language plpgsql security definer set search_path = public as $$
declare
  r      record;
  used   int;
  n      int := 0;
begin
  for r in
    select * from public.subscriptions
     where pending_plan_key is not null
       and pending_from is not null
       and pending_from <= now()
  loop
    select count(*) into used
      from public.profiles p
     where p.company_id = r.company_id and not p.disabled;

    -- 예약해 둔 사이에 직원이 늘어 한도를 넘겨 버린 경우.
    -- 낮은 요금으로 더 많은 자리를 쓰게 둘 수는 없으므로 예약을 취소합니다.
    if r.pending_seat_limit is not null and used > r.pending_seat_limit then
      update public.subscriptions
         set pending_plan_key = null, pending_plan_name = null,
             pending_price = null, pending_seat_limit = null, pending_from = null
       where company_id = r.company_id;

      insert into public.audit_log (company_id, actor_id, action, target, detail)
      values (r.company_id, null, 'plan_change_aborted', r.pending_plan_key,
              jsonb_build_object('used', used, 'limit', r.pending_seat_limit));
      -- ⚠ 여기서 고객에게 알려야 합니다. 메일 발송이 아직 없습니다.
      continue;
    end if;

    update public.subscriptions
       set plan_key = r.pending_plan_key,
           plan_name = r.pending_plan_name,
           price = r.pending_price,
           seat_limit = r.pending_seat_limit,
           period_start = now(),
           period_end = now() + interval '1 month',
           pending_plan_key = null, pending_plan_name = null,
           pending_price = null, pending_seat_limit = null, pending_from = null
     where company_id = r.company_id;

    insert into public.audit_log (company_id, actor_id, action, target, detail)
    values (r.company_id, null, 'plan_change_applied', r.pending_plan_key,
            jsonb_build_object('from', r.plan_key, 'to', r.pending_plan_key));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.apply_due_plan_changes() from public;
grant execute on function public.apply_due_plan_changes() to service_role;

-- ───────────────── 좌석 제한 ─────────────────
-- 요금제가 허용한 수를 넘겨 계정을 만들지 못하게 막습니다.
-- 앱에도 같은 검사가 있지만, 앱을 거치지 않고 들어오는 길이 있으므로
-- 마지막 방어선을 데이터베이스에 둡니다.
--
-- 정지된(disabled) 계정은 세지 않습니다. 사람이 나갔는데 자리를
-- 계속 차지하고 있으면 요금을 더 내야 하니까요.
create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  lim  int;
  used int;
begin
  -- 정지 상태로 들어오거나 정지된 채로 있는 것은 자리를 쓰지 않습니다
  if new.disabled then
    return new;
  end if;
  if tg_op = 'UPDATE' and not old.disabled then
    return new;                                   -- 이미 자리를 쓰던 계정입니다
  end if;

  select s.seat_limit into lim
    from public.subscriptions s
   where s.company_id = new.company_id;

  if lim is null then
    return new;                                   -- 구독이 없거나(기존 회사) 제한 없음
  end if;

  select count(*) into used
    from public.profiles p
   where p.company_id = new.company_id and not p.disabled;

  if used >= lim then
    raise exception
      '요금제의 직원 수 한도(%명)를 다 쓰셨습니다. 상위 요금제로 바꾸시거나 쓰지 않는 계정을 정지해 주세요.', lim
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists profiles_seat_limit on public.profiles;
create trigger profiles_seat_limit
  before insert or update of disabled, company_id on public.profiles
  for each row execute function public.enforce_seat_limit();


-- ───────────────── 접근 규칙 ─────────────────
alter table public.subscriptions  enable row level security;
alter table public.billing_methods enable row level security;

-- 구독은 회사 사람이 봅니다. 금액이 아니라 상태와 한도만 들어 있어
-- 직원이 봐도 문제가 없고, "자리가 몇 개 남았는지"를 앱이 보여줘야 합니다.
drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select to authenticated
  using (company_id = public.current_company_id());

-- 고치는 것은 서버 함수만 합니다. update/insert/delete 정책을 두지 않습니다.
-- 직원이 자기 회사 seat_limit 을 늘리는 일이 없어야 합니다.

-- billing_methods 에는 정책을 하나도 만들지 않습니다.
-- RLS 가 켜져 있고 정책이 없으면 authenticated 는 한 줄도 못 봅니다.
-- 이것이 의도입니다 — 지우지 마세요.


-- ───────────────── 남은 자리 ─────────────────
-- 앱이 "직원 추가" 단추를 보여줄지 정할 때 씁니다.
create or replace function public.seats_left()
returns table (seat_limit int, used int, remaining int)
language sql stable security definer set search_path = public as $$
  with co as (select public.current_company_id() as id)
  select
    s.seat_limit,
    (select count(*)::int from public.profiles p
      where p.company_id = (select id from co) and not p.disabled),
    case when s.seat_limit is null then null
         else greatest(0, s.seat_limit - (select count(*)::int from public.profiles p
                where p.company_id = (select id from co) and not p.disabled))
    end
  from public.subscriptions s
  where s.company_id = (select id from co)
$$;

revoke all on function public.seats_left() from public;
grant execute on function public.seats_left() to authenticated;
