#!/bin/bash
# 회사와 첫 관리자 계정을 만듭니다.
#
#   bash setup-admin.sh
#
# 비밀번호는 화면에 보이지 않고, 셸 기록에도 남지 않습니다.
# 특수문자가 들어가도 안전하도록 JSON 은 파이썬이 만듭니다.

set -u
cd "$(dirname "$0")"

REF="izrtclsqhsgkuwsffifn"
URL="https://${REF}.supabase.co/functions/v1/admin-user"
SECRET_FILE=".setup-secret"

if [ ! -f "$SECRET_FILE" ]; then
  echo "설치 암호 파일($SECRET_FILE)이 없습니다."
  echo "supabase secrets set SETUP_SECRET=... 로 정한 값을 이 파일에 넣어 주세요."
  exit 1
fi
SETUP_SECRET="$(cat "$SECRET_FILE")"

echo "──────────────────────────────────"
echo " 회사와 첫 관리자 계정 만들기"
echo "──────────────────────────────────"
echo

read -r -p "회사 코드 (영문 대문자·숫자 4~12자): " CODE
if [ -z "$CODE" ]; then echo "회사 코드를 입력해 주세요."; exit 1; fi
CODE="$(echo "$CODE" | tr '[:lower:]' '[:upper:]')"

read -r -p "회사 이름 (예: 홍길동컴퍼니): " CONAME
if [ -z "$CONAME" ]; then echo "회사 이름을 입력해 주세요."; exit 1; fi

read -r -p "관리자 아이디 (영문 소문자·숫자) [admin]: " LOGIN
LOGIN="${LOGIN:-admin}"
LOGIN="$(echo "$LOGIN" | tr '[:upper:]' '[:lower:]')"

read -r -p "관리자 이름 (예: 홍길동): " NAME
if [ -z "$NAME" ]; then echo "관리자 이름을 입력해 주세요."; exit 1; fi

echo
read -r -s -p "비밀번호 (10자 이상): " PW; echo
read -r -s -p "비밀번호 확인: " PW2; echo
echo

if [ "$PW" != "$PW2" ]; then echo "비밀번호가 서로 다릅니다."; exit 1; fi
if [ ${#PW} -lt 10 ]; then echo "비밀번호는 10자 이상이어야 합니다."; exit 1; fi

echo "회사 $CODE ($CONAME) · 관리자 $LOGIN ($NAME) 로 만듭니다…"
echo

RESP=$(
  CODE="$CODE" CONAME="$CONAME" LOGIN="$LOGIN" NAME="$NAME" PW="$PW" \
  python3 -c 'import json,os,sys; sys.stdout.write(json.dumps({
    "action":"bootstrap","code":os.environ["CODE"],"companyName":os.environ["CONAME"],
    "loginId":os.environ["LOGIN"],"name":os.environ["NAME"],
    "password":os.environ["PW"]}, ensure_ascii=False))' \
  | curl -s -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "x-setup-secret: ${SETUP_SECRET}" \
      --data-binary @-
)

unset PW PW2

echo "$RESP"
echo
if echo "$RESP" | grep -q '"ok":true'; then
  echo "──────────────────────────────────"
  echo " 만들었습니다. 앱에서 이렇게 들어가세요."
  echo
  echo "   회사 코드 : $CODE"
  echo "   아이디    : $LOGIN"
  echo "   비밀번호  : 방금 정하신 것"
  echo "──────────────────────────────────"
else
  echo "만들지 못했습니다. 위 메시지를 확인해 주세요."
  exit 1
fi
