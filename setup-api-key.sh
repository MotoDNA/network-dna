#!/bin/bash
# Anthropic API 키를 서버에 넣습니다.
#
#   bash setup-api-key.sh
#
# 키는 화면에 보이지 않고, 셸 기록에도 남지 않습니다.
# 빈 값이나 형식이 이상한 값은 보내기 전에 막습니다.

set -u
REF="izrtclsqhsgkuwsffifn"

command -v supabase >/dev/null 2>&1 || {
  echo "supabase CLI 를 찾을 수 없습니다. PATH 를 확인해 주세요."; exit 1; }

echo "──────────────────────────────────"
echo " Anthropic API 키 설정"
echo "──────────────────────────────────"
echo
echo "console.anthropic.com 에서 받은 키를 붙여넣으세요."
echo "(입력해도 화면에 보이지 않습니다)"
echo

read -r -s -p "API 키: " AK; echo
echo

if [ -z "${AK:-}" ]; then
  echo "아무것도 입력되지 않았습니다. 다시 실행해 주세요."
  exit 1
fi
case "$AK" in
  sk-ant-*) : ;;
  *) echo "키가 sk-ant- 로 시작하지 않습니다. 잘못 복사되었을 수 있습니다."
     echo "받은 길이: ${#AK}자"
     exit 1 ;;
esac
if [ ${#AK} -lt 50 ]; then
  echo "키가 너무 짧습니다 (${#AK}자). 붙여넣다 잘렸을 수 있습니다."
  exit 1
fi

echo "키를 확인했습니다 (${#AK}자, sk-ant- 로 시작). 서버에 넣습니다…"
echo

supabase secrets set "ANTHROPIC_API_KEY=$AK" --project-ref "$REF"
RC=$?
unset AK

echo
if [ $RC -eq 0 ]; then
  echo "──────────────────────────────────"
  echo " 넣었습니다."
  echo " 앱에서 명함을 촬영해 확인해 보세요."
  echo "──────────────────────────────────"
else
  echo "실패했습니다. 위 메시지를 확인해 주세요."
  exit 1
fi
