-- subscriptions 표에 권한이 빠져 있었습니다 (2026-09-22)
--
-- 가입이 마지막 한 걸음에서 늘 실패했습니다 — "구독 정보를 만들지 못했습니다".
-- 표도 멀쩡하고 RLS 정책도 제대로 있는데, 정작 그 표를 만질 권한이
-- 아무에게도 없었습니다.
--
--   subscriptions  service_role : REFERENCES, TRIGGER, TRUNCATE   ← INSERT 가 없습니다
--   companies      service_role : SELECT, INSERT, UPDATE, DELETE, …
--
-- RLS 정책은 '누구의 줄을 보여 줄까'를 정할 뿐, 표를 열어 주지는 않습니다.
-- 권한이 없으면 정책은 쓰이지도 못합니다. 그래서 subscriptions_read 정책이
-- 있는데도 앱이 자기 구독을 읽지 못했습니다.
--
-- companies 와 똑같은 모양으로 맞춥니다.
--   service_role  — 서버 함수가 구독을 만들고 고칩니다. RLS 를 건너뜁니다.
--   authenticated — 읽기만. 정책이 제 회사 것으로 이미 좁혀 둡니다.

grant select, insert, update, delete on public.subscriptions to service_role;
grant select                        on public.subscriptions to authenticated;

-- PostgREST 가 권한을 캐시하고 있습니다. 바로 반영되도록 다시 읽힙니다.
notify pgrst, 'reload schema';

-- ── 같은 구멍이 두 군데 더 있었습니다 ──
--
-- 가입은 subscriptions 다음에 billing_methods 에 빌링키를 넣습니다.
-- 거기도 service_role 권한이 없어서, 구독을 고쳐도 바로 다음 줄에서
-- 또 막혔을 것입니다. signup_attempts(가입 시도 기록)도 마찬가지입니다.
--
-- 이 둘은 RLS 가 켜져 있고 정책이 하나도 없습니다 — 브라우저에서는
-- 누구도 읽지 못한다는 뜻이고, 빌링키는 그래야 맞습니다.
-- 그래서 authenticated 에게는 아무것도 주지 않습니다. 서버에게만 엽니다.

grant select, insert, update, delete on public.billing_methods  to service_role;
grant select, insert, update, delete on public.signup_attempts  to service_role;

notify pgrst, 'reload schema';
