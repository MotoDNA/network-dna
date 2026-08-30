#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 서버에 마이그레이션이 실제로 들어갔는지 확인합니다. 로그인 불필요.
#
# SQL 편집기를 열지 않고도 "정말 적용됐나"를 볼 수 있어야 합니다.
# 적용했다고 기록해 두고 실제로는 안 들어가 있던 적이 두 번 있었습니다.
#
# 원리 — PostREST 는 컬럼이 없으면 42703, 함수가 없으면 PGRST202 를 냅니다.
# 권한 오류(42501)는 "있는데 못 보는 것"이므로 있음으로 칩니다.
# ─────────────────────────────────────────────────────────────
set -uo pipefail
URL="https://izrtclsqhsgkuwsffifn.supabase.co"
KEY="sb_publishable_G5wx-YdgwUU630x1vKmZmQ_15BgxvEX"

col(){ # 표 . 컬럼
  local r; r=$(curl -s "$URL/rest/v1/$1?select=$2&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  case "$r" in
    *42703*) echo "없음" ;;
    *42P01*) echo "표없음" ;;
    *)       echo "있음" ;;
  esac
}
fn(){ # 함수
  # 본문 기본값은 반드시 올바른 JSON 이어야 합니다. 깨진 본문을 보내면
  # PostgREST 가 함수 존재 여부를 보기 전에 PGRST102 로 먼저 끊어서,
  # 없는 함수가 "있음"으로 보입니다. (한 번 당했습니다)
  local body="${2:-}"
  [ -z "$body" ] && body='{}'      # 중괄호는 셸 확장과 엉키므로 따로 넣습니다
  local r; r=$(curl -s -X POST "$URL/rest/v1/rpc/$1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
                -H "Content-Type: application/json" -d "$body")
  case "$r" in
    *PGRST202*) echo "없음" ;;
    *PGRST102*) echo "확인실패" ;;
    *)          echo "있음" ;;
  esac
}
tbl(){ # 표
  local r; r=$(curl -s "$URL/rest/v1/$1?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
  case "$r" in
    *42P01*|*PGRST205*) echo "없음" ;;
    *)                  echo "있음" ;;
  esac
}

row(){ printf "  %-28s %s\n" "$1" "$2"; }

echo "Re:Call 데이터베이스 상태  ($(date '+%Y-%m-%d %H:%M'))"
echo
echo "recall_0002_visibility.sql"
V1=$(col customers visibility);            row "customers.visibility"  "$V1"
V2=$(fn team_stats '{"p_from":"2026-01-01T00:00:00Z"}'); row "team_stats()" "$V2"
echo
echo "recall_0003_billing.sql"
B1=$(tbl subscriptions);                   row "subscriptions 표"      "$B1"
B2=$(tbl billing_methods);                 row "billing_methods 표"    "$B2"
B3=$(col companies industry_id);           row "companies.industry_id" "$B3"
B4=$(fn seats_left);                       row "seats_left()"          "$B4"
echo
echo "recall_0004_card_limits.sql"
# 인덱스는 PostgREST 로 볼 수 없습니다. 같은 트랜잭션에서 만들어지는
# card_usage() 를 대신 봅니다 — 이것이 있으면 인덱스도 함께 들어간 것입니다.
C1=$(fn card_usage);                       row "card_usage()"          "$C1"
echo

done_all(){ [ "$1" = "있음" ] && [ "$2" = "있음" ]; }
if done_all "$V1" "$V2"; then echo "  ✓ 0002 적용됨"; else echo "  ✗ 0002 미적용  →  ./apply-migration.sh recall_0002_visibility.sql"; fi
if done_all "$B1" "$B3"; then echo "  ✓ 0003 적용됨"; else echo "  ✗ 0003 미적용  →  ./apply-migration.sh recall_0003_billing.sql"; fi
if [ "$C1" = "있음" ];      then echo "  ✓ 0004 적용됨"; else echo "  ✗ 0004 미적용  →  ./apply-migration.sh recall_0004_card_limits.sql"; fi
