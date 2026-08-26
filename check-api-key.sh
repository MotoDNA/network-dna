#!/bin/bash
# Anthropic API 키가 서버에 제대로 들어갔는지 확인합니다.
#
#   bash check-api-key.sh
#
# 앱에 로그인하지 않아도 됩니다.
# 키 값은 화면에 나오지 않습니다. 길이와 형식, 그리고 Anthropic 이
# 실제로 그 키를 받아 주는지만 알려 줍니다.

set -u
REF="izrtclsqhsgkuwsffifn"
FN="https://${REF}.supabase.co/functions/v1/read-card"
# 공개 키입니다. 앱에도 그대로 들어 있습니다. 이것만으로는 아무것도 못 합니다.
PUB="sb_publishable_G5wx-YdgwUU630x1vKmZmQ_15BgxvEX"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$HERE/.setup-secret" ]; then
  echo "설치 암호 파일(.setup-secret)이 없습니다."
  exit 1
fi
SECRET="$(tr -d '\r\n' < "$HERE/.setup-secret")"

echo "──────────────────────────────────"
echo " API 키 점검"
echo "──────────────────────────────────"
echo

OUT="$(curl -sS -X POST "$FN" \
  -H "content-type: application/json" \
  -H "Authorization: Bearer $PUB" \
  -H "x-setup-secret: $SECRET" \
  -d '{"action":"selftest"}')"
RC=$?

if [ $RC -ne 0 ] || [ -z "$OUT" ]; then
  echo "함수에 닿지 못했습니다. 인터넷 연결과 배포 상태를 확인해 주세요."
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  printf '%s' "$OUT" | python3 -m json.tool --no-ensure-ascii 2>/dev/null || printf '%s\n' "$OUT"
else
  printf '%s\n' "$OUT"
fi

echo
case "$OUT" in
  *'"ok": true'*|*'"ok":true'*)
    echo "키가 정상입니다. 앱에서 명함을 촬영해 보세요." ;;
  *)
    echo "키에 문제가 있습니다. 위 error 를 보고 대시보드에서 다시 넣어 주세요."
    echo "  https://supabase.com/dashboard/project/${REF}/functions/secrets"
    exit 1 ;;
esac
