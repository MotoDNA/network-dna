-- ═══════════════════════════════════════════════════════════════
-- 명함 인식 한도 — 셀 수 있게 만들기
--
-- 한도 숫자는 여기에 없습니다. catalog.json 한 군데에만 있습니다.
-- 이 파일이 하는 일은 두 가지뿐입니다 —
--   1) 사용량을 세는 질의가 느려지지 않도록 인덱스를 답니다
--   2) 지금 얼마나 썼는지 사람이 볼 수 있게 함수를 하나 둡니다
--
-- 「하루」와 「한 달」은 한국시간(Asia/Seoul) 달력 기준입니다.
-- read-card 함수의 kstDayStart · kstMonthStart 와 같은 경계를 씁니다.
-- 한쪽만 고치면 화면에 보이는 숫자와 실제로 막히는 시점이 어긋납니다.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────── 인덱스 ─────────────────
-- read-card 는 명함 한 장을 읽을 때마다 audit_log 를 두 번 셉니다.
-- audit_log 는 계속 쌓이기만 하는 표라, 인덱스가 없으면
-- 회사가 오래될수록 명함 찍는 것이 느려집니다.
--
-- action = 'card.read' 만 걸러 담는 부분 인덱스입니다.
-- audit_log 에는 로그인·계정변경 따위가 훨씬 많이 쌓이는데
-- 그것까지 담으면 인덱스만 쓸데없이 커집니다.
--
-- concurrently 를 쓰지 않은 것은 apply-migration.sh 가 전체를
-- begin/commit 으로 묶기 때문입니다. 지금 크기에서는 잠깐입니다.

-- 하루 한도용 — 1인 기준
create index if not exists audit_card_actor_idx
  on public.audit_log (actor_id, at desc)
  where action = 'card.read';

-- 월 한도용 — 회사 전체 기준
create index if not exists audit_card_company_idx
  on public.audit_log (company_id, at desc)
  where action = 'card.read';


-- ───────────────── 지금 얼마나 썼나 ─────────────────
-- 한도에 걸린 뒤에야 알게 되면 늦습니다. 미리 볼 수 있어야 합니다.
--
-- 한도 숫자를 돌려주지 않는 것은 의도한 것입니다 —
-- 그 값은 catalog.json 에 있고, 앱은 이미 그 파일을 봅니다.
-- 두 군데서 오면 언젠가 어긋납니다.
create or replace function public.card_usage()
returns table (used_today int, used_month int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.audit_log a
      where a.actor_id = auth.uid()
        and a.action = 'card.read'
        and a.at >= (date_trunc('day', now() at time zone 'Asia/Seoul')
                     at time zone 'Asia/Seoul')),
    (select count(*)::int from public.audit_log a
      where a.company_id = public.current_company_id()
        and a.action = 'card.read'
        and a.at >= (date_trunc('month', now() at time zone 'Asia/Seoul')
                     at time zone 'Asia/Seoul'))
$$;

revoke all on function public.card_usage() from public;
grant execute on function public.card_usage() to authenticated;
