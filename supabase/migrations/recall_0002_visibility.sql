-- ═══════════════════════════════════════════════════════════════
-- 고객별 공개 범위
--
-- 지금까지는 "공유 목록"이라는 수단 하나로만 범위를 표현했습니다.
-- 그래서 "팀 전체가 봐도 되는 고객"과 "나만 보는 고객"을 구분할 수 없었습니다.
-- 의도를 데이터에 남깁니다.
--
--   company  공개      — 회사 사람 모두
--   shared   선택공개  — 담당자 + 공유받은 사람 + 관리자   (지금까지의 동작)
--   private  비공개    — 담당자 본인만. 관리자도 내용은 못 봅니다
--
-- 기존 고객은 모두 shared 가 됩니다. 오늘과 똑같이 동작하니
-- 이 마이그레이션만으로는 보이던 것이 사라지지 않습니다.
-- ═══════════════════════════════════════════════════════════════

alter table public.customers
  add column if not exists visibility text not null default 'shared';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'customers_visibility_chk') then
    alter table public.customers
      add constraint customers_visibility_chk
      check (visibility in ('company','shared','private'));
  end if;
end $$;

-- 비공개가 아닌 것만 훑도록 (목록 조회가 이 순서로 걸립니다)
create index if not exists customers_visibility_idx
  on public.customers(company_id, visibility) where not deleted;

-- ───────────────── 고객 조회 규칙 다시 쓰기 ─────────────────
-- 관리자는 공개와 선택공개까지만 봅니다. 비공개는 담당자 본인만입니다.
-- (관리자가 "비공개가 몇 건 있다"는 것은 아래 team_stats 로 알 수 있습니다)
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (
      owner_id = auth.uid()                                   -- 내 고객은 언제나
      or visibility = 'company'                               -- 공개는 회사 모두
      or (visibility = 'shared'
          and (public.is_admin() or auth.uid() = any(shared_ids)))
    )
  );

-- 고칠 수 있는 범위도 볼 수 있는 범위와 같아야 합니다.
-- 그렇지 않으면 id 를 아는 사람이 못 보는 고객을 고칠 수 있습니다.
drop policy if exists customers_update on public.customers;
create policy customers_update on public.customers
  for update to authenticated
  using (
    company_id = public.current_company_id()
    and (
      owner_id = auth.uid()
      or visibility = 'company'
      or (visibility = 'shared'
          and (public.is_admin() or auth.uid() = any(shared_ids)))
    )
  )
  with check (
    company_id = public.current_company_id()
    and exists (select 1 from public.profiles p
                 where p.id = owner_id and p.company_id = public.current_company_id())
  );

-- 타임라인은 따로 손대지 않습니다.
-- activities_read 가 "그 고객이 보이면"으로 되어 있어서,
-- 비공개 고객의 기록은 위 규칙에 따라 자동으로 함께 가려집니다.

-- 진짜 삭제는 관리자만 하는 것을 그대로 둡니다.
-- 비공개 고객을 관리자가 볼 수는 없지만 지울 수는 있습니다.
-- 직원이 나간 뒤 회사가 데이터를 정리할 길은 남겨 둡니다.

-- ═══════════════════════════════════════════════════════════════
-- 팀 현황판이 쓰는 집계
--
-- 내용은 한 줄도 내보내지 않고 숫자만 셉니다.
-- security definer 라 행 단위 규칙을 건너뛰지만,
-- 회사 안으로만 한정하므로 남의 회사 숫자는 나오지 않습니다.
--
-- 비공개 건수는 관리자에게만 알려 줍니다. 직원끼리
-- "쟤가 3건 숨기고 있네"를 보게 할 이유가 없습니다.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.team_stats(p_from timestamptz)
returns table (
  member_id   uuid,
  acts_n      bigint,   -- 기간 안에 남긴 기록 수 (비공개 고객 것도 포함)
  cust_n      bigint,   -- 담당 고객 수 (비공개 포함)
  private_n   bigint    -- 그중 비공개. 관리자가 아니면 0
)
language sql stable security definer set search_path = public as $$
  with co as (select public.current_company_id() as id),
       adm as (select public.is_admin() as yes)
  select
    p.id,
    (select count(*) from public.activities a
      where a.company_id = (select id from co)
        and a.by_id = p.id and not a.deleted and a.at >= p_from),
    (select count(*) from public.customers c
      where c.company_id = (select id from co)
        and c.owner_id = p.id and not c.deleted),
    case when (select yes from adm)
      then (select count(*) from public.customers c
             where c.company_id = (select id from co)
               and c.owner_id = p.id and not c.deleted
               and c.visibility = 'private')
      else 0::bigint end
  from public.profiles p
  where p.company_id = (select id from co)
    and (select id from co) is not null
    and not p.disabled
$$;

revoke all on function public.team_stats(timestamptz) from public;
grant execute on function public.team_stats(timestamptz) to authenticated;
