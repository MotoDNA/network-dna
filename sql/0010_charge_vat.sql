-- 청구 기록에 공급가액과 부가세를 나눠 적습니다 (2026-09-22)
--
-- 요금표의 금액은 전부 공급가액이고 화면에도 '부가세 별도'라고 적어 뒀는데,
-- 정작 카드에서는 공급가액만 긁고 있었습니다. 19,000원이라 써 놓고
-- 19,000원을 긁었으니, 부가세 1,900원을 우리가 떠안고 있던 셈입니다.
--
-- 이제 amount 는 **실제로 긁은 돈**(공급가액+부가세)입니다. 나중에
-- 세금계산서를 끊거나 장부를 맞추려면 둘이 나뉘어 있어야 합니다.

alter table public.billing_charges
  add column if not exists supply_amount integer,
  add column if not exists vat_amount    integer;

-- 이미 있는 줄은 공급가액만 들어 있습니다. 그대로 옮겨 적습니다.
update public.billing_charges
   set supply_amount = coalesce(supply_amount, amount),
       vat_amount    = coalesce(vat_amount, 0)
 where supply_amount is null;

comment on column public.billing_charges.amount        is '실제로 카드에서 긁은 돈 (공급가액 + 부가세)';
comment on column public.billing_charges.supply_amount is '공급가액. 요금표에 적힌 값';
comment on column public.billing_charges.vat_amount    is '부가가치세';

notify pgrst, 'reload schema';
