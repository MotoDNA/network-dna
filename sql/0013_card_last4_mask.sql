-- 토스는 카드번호를 43301234****123* 처럼 끝자리까지 가려서 줍니다.
-- card_last4 는 "숫자 넉 자" 만 받게 되어 있어서, 실제 카드를 등록하면 저장이 막혔습니다
-- (시험 카드 때는 값이 비어 있어 드러나지 않았습니다). 가림표(*)를 허용합니다.
-- 고객이 "아, 그 카드" 하고 알아보게 하려는 값이라 결제에는 쓰이지 않습니다.
alter table public.billing_methods drop constraint if exists billing_last4_fmt;
alter table public.billing_methods add constraint billing_last4_fmt
  check (card_last4 is null or card_last4 ~ '^[0-9*]{4}$');
