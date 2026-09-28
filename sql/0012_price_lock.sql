-- 요금을 올릴 때는 30일을 기다립니다 (2026-09-28)
--
-- 이용약관 제9조: "회사는 요금을 변경할 수 있으며, 변경된 요금은
-- 공지 후 30일이 지난 다음 결제일부터 적용됩니다."
--
-- 그런데 일꾼(billing-run)은 걷을 때마다 요금표로 **다시 셉니다**. 서비스를
-- 더하거나 뺀 것이 바로 반영되게 하려고 그렇게 만들었는데, 요금표 자체를
-- 올리면 그 순간 모든 회사가 새 값으로 걷히게 됩니다. 약관 위반입니다.
--
-- 그래서 잠금 자리를 둡니다. 이 날짜가 지나기 전까지는 적어 둔 price 를
-- 그대로 걷고, 요금표로 다시 세지 않습니다. 날짜가 지나면 저절로 새 값으로
-- 넘어갑니다 — 따로 해 줄 일이 없습니다.
--
-- 내리는 경우에는 잠글 필요가 없습니다. 약관은 올릴 때를 막는 것이고,
-- 싸지는 것을 30일 미루는 것은 고객에게 손해입니다.

alter table public.subscriptions
  add column if not exists price_locked_until timestamptz;

comment on column public.subscriptions.price_locked_until is
  '이 때까지는 요금표를 다시 세지 않고 적어 둔 price 를 걷습니다. 요금 인상 고지 후 30일(약관 제9조).';

-- ── 2026-09-28 서비스별 단가 도입 ──
-- Re:Bind·Re:Call 은 값이 그대로라 잠글 것이 없습니다.
-- 오르는 두 회사만 잠급니다.
--
--   ACTIVA  87,000 → 93,000  (Re:O-S 가 비싸졌습니다)
--   9DORO   49,000 → 59,000  (Re:Store 가 비싸졌습니다)
--
-- ⚠ 이 잠금은 '고지했다'는 뜻이 아닙니다. 고지는 사람이 해야 합니다.
--   두 회사에 알리지 않으셨다면 날짜를 고지한 날 기준으로 다시 잡으세요.

update public.subscriptions s
   set price_locked_until = now() + interval '30 days'
  from public.companies c
 where c.id = s.company_id
   and c.code in ('ACTIVA', '9DORO')
   and s.price_locked_until is null;

notify pgrst, 'reload schema';
