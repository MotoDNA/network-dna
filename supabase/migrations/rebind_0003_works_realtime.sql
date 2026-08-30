-- ═══════════════════════════════════════════════════════════════
-- Re:Bind — 실시간 알림만 켭니다
--
-- ⚠ 이 파일은 표를 만들지도, 고치지도, 지우지도 않습니다.
--   rebind 0002_works.sql 은 이미 서버에 적용되어 있고
--   (projects · project_steps · company_settings 모두 존재 확인, 2026-08-30),
--   거기에는 실제 제조 데이터가 들어 있습니다.
--
--   0002 를 통째로 다시 실행하지 마세요. 첫 create table 에서 멈춥니다.
--   그 오류를 drop table 로 "고치면" 그 순간 데이터가 사라집니다.
--   이미 적용된 마이그레이션은 다시 쓰는 것이 아니라, 이렇게 얹습니다.
--
-- 팀원이 공정을 올리면 다른 사람 화면도 바로 따라오게 합니다.
-- 이 줄이 없어도 앱은 25초마다 스스로 다시 받아 오므로 동작합니다.
-- ═══════════════════════════════════════════════════════════════

-- publication 이 없는 환경에서도, 이미 등록된 뒤에 다시 돌려도
-- 멈추지 않도록 감싸 둡니다. 몇 번을 실행해도 안전합니다.
do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.project_steps;
exception when others then null;
end $$;

-- 확인 — 두 줄이 나오면 켜진 것입니다.
-- select tablename from pg_publication_tables
--  where pubname = 'supabase_realtime'
--    and tablename in ('projects','project_steps');
