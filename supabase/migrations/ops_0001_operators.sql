-- ═══════════════════════════════════════════════════════════════
-- 운영자 — DNA Labs 사람만
--
-- 지금까지 "회사 셋을 한 화면에서 보는 사람" 이라는 개념이 없었습니다.
-- profiles.role 은 **회사 안**의 admin/user 라, 다른 회사는 어차피 안 보입니다.
-- 그게 맞는 설계입니다. 고객사끼리는 서로 안 보여야 합니다.
--
-- 그래서 운영자를 만들 때 두 갈래가 있었습니다.
--
--   ㄱ. RLS 정책마다 "또는 운영자면 통과" 를 덧붙인다
--       정책이 스무 개가 넘습니다. 한 군데만 잘못 쓰면 그 표가 통째로 열립니다.
--       그리고 앞으로 정책을 더할 때마다 잊지 않고 붙여야 합니다.
--
--   ㄴ. RLS 는 그대로 두고, service_role 을 쓰는 **서버 함수 하나**가 문지기를 한다
--       브라우저가 들고 있는 열쇠로는 여전히 남의 회사가 안 보입니다.
--       힘은 함수 안에만 있고, 그 함수는 파일 하나라 통째로 읽어 볼 수 있습니다.
--
-- ㄴ 으로 갑니다. 이 표는 **그 함수만 읽습니다.**
--
-- 정책을 하나도 만들지 않는 것이 의도입니다.
-- RLS 를 켜 두고 정책이 없으면 authenticated 는 아무것도 못 합니다 —
-- 로그인한 사람이 "나는 운영자인가" 조차 직접 물어볼 수 없습니다.
-- 물어보려면 함수를 거쳐야 하고, 그러면 기록이 남습니다.
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.operators (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  memo       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;
alter table public.operators force row level security;

-- 정책 없음 = 브라우저에서는 아무도 못 읽고 못 씁니다. service_role 만 지나갑니다.
revoke all on public.operators from anon, authenticated;
grant all privileges on public.operators to service_role;

comment on table public.operators is
  'DNA Labs 운영자. ops 함수만 읽습니다. 정책이 없는 것은 의도입니다 — '
  '브라우저에서는 이 표에 손이 닿지 않아야 합니다.';

-- ── 운영자가 남기는 기록 ──
-- audit_log.company_id 는 이미 nullable 이라 회사에 매이지 않는 일도 담깁니다
-- (예: 회사 만들기 전의 실패, 목록 조회). 표를 새로 만들지 않습니다.
create index if not exists audit_actor_idx on public.audit_log(actor_id, at desc);
