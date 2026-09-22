-- 매일 새벽에 요금 걷는 일꾼을 깨웁니다 (2026-09-22)
--
-- 토스는 정기결제를 대신 돌려 주지 않습니다. 깨우는 것도 우리 몫입니다.
--   pg_cron — 정해진 때에 SQL 을 돌립니다
--   pg_net  — SQL 에서 바깥 주소를 부릅니다
--
-- ⚠ 자물쇠(BILLING_SECRET)를 cron.job 의 명령문에 그대로 적으면, 그 표를
--   읽을 수 있는 사람은 누구나 요금을 걷을 수 있게 됩니다. 그래서 금고
--   (Vault)에 넣고, 꺼내는 일은 아래 함수만 하게 합니다.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- 금고에 자물쇠를 넣습니다. 같은 이름이 있으면 새 값으로 바꿉니다.
-- ⚠ 이 저장소는 공개입니다. 돌리기 전에 아래 자리를 손으로 채우고,
--    채운 파일은 커밋하지 마세요. 값은 supabase secrets 의 BILLING_SECRET 과 같아야 합니다.
do $$
declare 있나 uuid;
begin
  select id into 있나 from vault.secrets where name = 'billing_secret';
  if 있나 is null then
    perform vault.create_secret('<<자물쇠를 여기에 — 저장소에 적지 마세요>>', 'billing_secret', '요금 걷는 일꾼을 부를 때 쓰는 자물쇠');
  else
    perform vault.update_secret(있나, '<<자물쇠를 여기에 — 저장소에 적지 마세요>>');
  end if;
end $$;

-- 일꾼을 부르는 문. 자물쇠는 이 안에서만 꺼냅니다.
create or replace function public.run_billing()
returns bigint
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare 자물쇠 text; 표 bigint;
begin
  select decrypted_secret into 자물쇠 from vault.decrypted_secrets where name = 'billing_secret';
  if 자물쇠 is null then
    raise exception '금고에 billing_secret 이 없습니다';
  end if;

  select net.http_post(
    url     := 'https://izrtclsqhsgkuwsffifn.supabase.co/functions/v1/billing-run',
    headers := jsonb_build_object('Content-Type','application/json','x-billing-secret',자물쇠),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into 표;
  return 표;
end $$;

-- 아무나 부르지 못하게. postgres(=cron)만 부릅니다.
revoke all on function public.run_billing() from public, anon, authenticated, service_role;

-- 매일 새벽 4시(한국)에 한 번. 서버 시계는 UTC 라 19:00 입니다.
select cron.unschedule('요금걷기') where exists (select 1 from cron.job where jobname = '요금걷기');
select cron.schedule('요금걷기', '0 19 * * *', 'select public.run_billing()');
