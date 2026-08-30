#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 마이그레이션 하나를 SQL 편집기에 통째로 붙여넣을 형태로 만듭니다.
#
#   ./apply-migration.sh                      아직 적용 안 된 것을 알려줍니다
#   ./apply-migration.sh recall_0003_billing.sql   그것을 클립보드에 담습니다
#
# 앞에 안전장치를, 전체를 begin/commit 으로 묶고, 뒤에 확인 질의를 붙입니다.
# 본문은 원본을 그대로 읽어오므로 사본이 어긋날 일이 없습니다.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"
DIR="supabase/migrations"

if [ $# -eq 0 ]; then
  echo "적용할 마이그레이션을 고르세요:"; echo
  for f in "$DIR"/*.sql; do echo "  ./apply-migration.sh $(basename "$f")"; done
  echo
  echo "지금 서버에 무엇이 있는지 확인하려면:"
  echo "  ./check-db.sh"
  exit 0
fi

NAME="$(basename "$1")"
SRC="$DIR/$NAME"
[ -f "$SRC" ] || { echo "‼ $SRC 을 찾을 수 없습니다"; exit 1; }

# 머리글에 어느 프로젝트 것인지 적습니다.
# 예전에는 무조건 "Re:Call" 이라고 적혀서, Re:Bind 파일을 붙여넣고도
# Re:Call 이라고 뜨는 바람에 헷갈렸습니다.
case "$NAME" in
  rebind_*) PROJ="Re:Bind" ;;
  recall_*) PROJ="Re:Call" ;;
  *)        PROJ="Re:Call · Re:Bind 공용" ;;
esac

OUT="$(mktemp -t recall-mig-XXXXXX)"
{
cat <<HEAD
-- ╔══════════════════════════════════════════════════════════╗
-- ║  $PROJ · $NAME
-- ║  전체를 한 번에 실행하세요. 아무것도 선택하지 말고 Run.
-- ╚══════════════════════════════════════════════════════════╝

begin;

HEAD
cat <<'GUARD'
-- ── 안전장치 · 여기가 맞는 데이터베이스인지 먼저 봅니다 ──
do $guard$
begin
  if to_regclass('public.customers')  is null
  or to_regclass('public.profiles')   is null
  or to_regclass('public.activities') is null then
    raise exception
      '여기는 Re:Call 데이터베이스가 아닙니다. 프로젝트가 network-dna (izrtclsqhsgkuwsffifn) 인지 확인하세요.';
  end if;
  if to_regprocedure('public.current_company_id()') is null
  or to_regprocedure('public.is_admin()')           is null then
    raise exception '0001_init.sql 이 먼저 적용되어야 합니다.';
  end if;
end
$guard$;

GUARD
cat "$SRC"
cat <<'MID'

commit;

MID

# 확인 질의는 프로젝트마다 다릅니다.
# Re:Bind 파일에 Re:Call 표를 세어 보여 주면 "전부 0" 이라 실패한 줄 압니다.
if [ "$PROJ" = "Re:Bind" ]; then
cat <<'TAIL'
-- ── 확인 · 실시간 알림이 켜졌는지 ──
-- 두 줄(projects · project_steps)이 나오면 켜진 것입니다.
select tablename from pg_publication_tables
 where pubname = 'supabase_realtime'
   and tablename in ('projects','project_steps');
TAIL
else
cat <<'TAIL'
-- ── 확인 · 지금 서버에 무엇이 있는지 ──
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='customers'
      and column_name='visibility')                        as "recall_0002_컬럼",
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='team_stats')    as "recall_0002_team_stats",
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='subscriptions') as "recall_0003_구독표",
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='gen_company_code') as "recall_0003_회사코드함수",
  (select count(*) from pg_indexes where schemaname='public'
    and indexname in ('audit_card_actor_idx','audit_card_company_idx')) as "recall_0004_인덱스_2면정상",
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='card_usage')     as "recall_0004_card_usage";
TAIL
fi
} > "$OUT"

LINES=$(wc -l < "$OUT" | tr -d ' ')
if command -v pbcopy >/dev/null 2>&1; then
  pbcopy < "$OUT"; echo "✓ $NAME 을 클립보드에 담았습니다 (${LINES}줄)."
else
  echo "· 클립보드 복사 불가. 파일을 여세요: $OUT"
fi

cat <<MSG

   1. https://supabase.com/dashboard/project/izrtclsqhsgkuwsffifn/sql/new
   2. 편집기를 클릭하고  ⌘V  →  ⌘Enter
   3. 맨 아래 확인표에서 0 인 칸이 없으면 들어간 것입니다
      (0004_인덱스 칸만 2 이고 나머지는 1 입니다)

   ⚠ Re:Call 순서 — recall_0002 → recall_0003 → recall_0004.
      recall_0004 는 recall_0003 이 먼저 있어야 뜻이 있습니다.
      rebind_ 로 시작하는 것은 Re:Bind 것이라 이 순서와 무관합니다.

   전문 보기: $OUT
MSG
