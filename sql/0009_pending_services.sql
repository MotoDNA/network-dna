-- 서비스를 더하고 빼는 자리 (2026-09-22)
--
-- 규칙은 요금제를 올리고 내리는 것과 같습니다. 환불정책 제5조 그대로입니다.
--
--   더할 때 — 지금 바로 쓰실 수 있고, 이번 달 남은 날짜만큼만 차액을 받습니다
--   뺄 때   — 다음 결제일에 빠집니다. 이미 낸 돈은 돌려드리지 않고,
--             그날까지는 그대로 쓰십니다
--
-- 빼는 것은 '예약'이라 어딘가 적어 둬야 합니다. 요금제 변경이 쓰던
-- pending_* 자리를 서비스에도 쓰도록 넓힙니다. 둘이 동시에 걸려 있어도
-- 적용 시점(pending_from)이 같으므로 한꺼번에 처리됩니다.

alter table public.subscriptions
  add column if not exists pending_tier_key text,
  add column if not exists pending_services integer,
  add column if not exists pending_apps     text[];

-- ── 예약해 둔 변경을 때가 되면 적용합니다 ──
-- 요금제만 보던 것을 서비스까지 보도록 고칩니다.
create or replace function public.apply_due_plan_changes()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r    record;
  used int;
  n    int := 0;
begin
  for r in
    select * from public.subscriptions
     where pending_from is not null
       and pending_from <= now()
       and (pending_plan_key is not null or pending_apps is not null)
  loop
    select count(*) into used
      from public.profiles p
     where p.company_id = r.company_id and not p.disabled;

    -- 예약해 둔 사이에 직원이 늘어 한도를 넘겨 버린 경우.
    -- 낮은 요금으로 더 많은 자리를 쓰게 둘 수는 없으므로 예약을 취소합니다.
    if r.pending_plan_key is not null
       and r.pending_seat_limit is not null and used > r.pending_seat_limit then
      update public.subscriptions
         set pending_plan_key = null, pending_plan_name = null, pending_tier_key = null,
             pending_price = null, pending_seat_limit = null,
             pending_services = null, pending_apps = null, pending_from = null
       where company_id = r.company_id;

      insert into public.audit_log (company_id, actor_id, action, target, detail)
      values (r.company_id, null, 'plan_change_aborted', r.pending_plan_key,
              jsonb_build_object('used', used, 'limit', r.pending_seat_limit));
      -- ⚠ 여기서 고객에게 알려야 합니다. 메일 발송이 아직 없습니다.
      continue;
    end if;

    -- 서비스를 빼기로 하셨다면 회사의 서비스 목록에서 지웁니다.
    -- 여기가 실제로 문이 닫히는 자리입니다 — 화면이 아니라 이 값이 막습니다.
    if r.pending_apps is not null then
      update public.companies set apps = r.pending_apps where id = r.company_id;
    end if;

    update public.subscriptions
       set plan_key     = coalesce(r.pending_plan_key,  plan_key),
           plan_name    = coalesce(r.pending_plan_name, plan_name),
           tier_key     = coalesce(r.pending_tier_key,  tier_key),
           price        = coalesce(r.pending_price,     price),
           seat_limit   = coalesce(r.pending_seat_limit, seat_limit),
           services     = coalesce(r.pending_services,  services),
           period_start = now(),
           period_end   = now() + interval '1 month',
           pending_plan_key = null, pending_plan_name = null, pending_tier_key = null,
           pending_price = null, pending_seat_limit = null,
           pending_services = null, pending_apps = null, pending_from = null
     where company_id = r.company_id;

    insert into public.audit_log (company_id, actor_id, action, target, detail)
    values (r.company_id, null,
            case when r.pending_apps is not null then 'service_removed' else 'plan_change_applied' end,
            coalesce(r.pending_plan_key, 'services'),
            jsonb_build_object('from_plan', r.plan_key, 'to_plan', r.pending_plan_key,
                               'from_services', r.services, 'to_services', r.pending_services,
                               'apps', r.pending_apps));
    n := n + 1;
  end loop;
  return n;
end $function$;

notify pgrst, 'reload schema';
