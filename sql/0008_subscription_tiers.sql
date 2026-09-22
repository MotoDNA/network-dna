-- 구독에 '서비스 개수'를 적습니다 (2026-09-22)
--
-- 공개한 요금표는 인원 구간 × 서비스 개수입니다.
--
--   인원        1개        2개        3개        4개
--   1명         19,000     28,000     37,000     46,000
--   5명까지     49,000     68,000     87,000     106,000
--   20명까지    99,000     138,000    177,000    216,000
--   49명까지    249,000    348,000    447,000    546,000
--
-- 그런데 청구 코드는 plans(인원만) 를 봤습니다. plans 의 값이 위 표의
-- 첫 열과 같아서, 네 개를 쓰셔도 19,000원이 걷혔습니다.
--
-- 셈은 base + addon × (개수 - 1) 이고, 그 값은 catalog.json 하나에만 둡니다.
-- 여기(데이터베이스)에는 '무엇을 샀는가'만 적습니다. 금액을 두 군데서 계산하면
-- 언젠가 서로 달라지고, 그날이 결제 사고 나는 날입니다.

alter table public.subscriptions
  add column if not exists tier_key text,
  add column if not exists services integer not null default 1;

alter table public.subscriptions drop constraint if exists subscriptions_services_chk;
alter table public.subscriptions add constraint subscriptions_services_chk
  check (services between 1 and 4);

-- 옛 plan_key 를 새 구간 이름으로 옮깁니다. 값은 같은 사다리입니다.
update public.subscriptions set tier_key = case plan_key
    when 'personal'   then 'solo'
    when 'business5'  then 't5'
    when 'business20' then 't20'
    when 'business49' then 't49'
    when 'enterprise' then 'ent'
  end
where tier_key is null;

-- 지금 쓰고 있는 서비스 개수로 채웁니다. 비어 있으면 1 로 둡니다.
update public.subscriptions s
   set services = greatest(1, coalesce(array_length(c.apps, 1), 1))
  from public.companies c
 where c.id = s.company_id;

-- ── 가입이 산 서비스를 안 적고 있었습니다 ──
-- companies.apps 가 비면 어느 서비스에도 못 들어갑니다. 화면이 아니라
-- 데이터베이스가 막습니다 (company_for_app 이 정책마다 들어 있습니다).
-- 가입 함수도 함께 고쳤습니다. 이미 만들어진 회사만 여기서 메웁니다.
update public.companies set apps = array['recall']
 where (apps is null or cardinality(apps) = 0);

notify pgrst, 'reload schema';
