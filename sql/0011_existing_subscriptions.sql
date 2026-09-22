-- 기존 고객에게 요금제를 붙입니다 (2026-09-22)
--
-- 구독 표가 생기기 전에 만들어진 회사들입니다. 쓰고는 계신데 요금제가
-- 붙어 있지 않아, 자기가 얼마 내는지도 못 보고 서비스를 더할 수도
-- 없었습니다. 인원과 점포 수를 보고 아래와 같이 정했습니다.
--
--   ACTIVA  직원 2명 · 서비스 3개  → 5명까지 × 3개 = 87,000
--   BKT     직원 3명 · 서비스 1개  → 5명까지 × 1개 = 49,000
--   9DORO   점포 1개 · 서비스 1개  → 10개까지 × 1개 = 49,000
--
-- 9DORO 만 tier_key 가 s10 입니다. Re:Store 는 인원이 아니라 점포 수로
-- 줄을 고르기 때문입니다. 금액 사다리는 같은 것을 씁니다.
--
-- DNALABS(우리 회사)와 DEMO(심사용)는 청구 대상이 아니라 넣지 않습니다.
--
-- ⚠ 여기 적는 price 는 공급가액입니다. 부가세는 걷을 때 붙습니다.
-- ⚠ 이 회사들은 아직 카드가 등록돼 있지 않습니다. 결제일이 오면 일꾼이
--   'past_due' 로 두고 넘어갑니다. 실제로 걷으려면 각 회사가 카드를
--   등록해야 합니다.
--
-- 이미 요금제가 있는 회사는 건드리지 않습니다. 두 번 돌려도 안전합니다.

do $$
declare r record;
begin
  for r in
    select * from (values
      ('ACTIVA', 'business5', 'Business 5', 't5',  3, 87000, 5),
      ('BKT',    'business5', 'Business 5', 't5',  1, 49000, 5),
      ('9DORO',  'business5', '10개까지',   's10', 1, 49000, 5)
    ) as v(code, plan_key, plan_name, tier_key, services, price, seat_limit)
  loop
    insert into public.subscriptions
      (company_id, plan_key, plan_name, tier_key, services, price, seat_limit,
       status, period_start, period_end)
    select c.id, r.plan_key, r.plan_name, r.tier_key, r.services, r.price, r.seat_limit,
           'active', now(), now() + interval '1 month'
      from public.companies c
     where c.code = r.code
    on conflict (company_id) do nothing;    -- 이미 있으면 그대로 둡니다
  end loop;
end $$;
