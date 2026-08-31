#!/usr/bin/env bash
# 운영자(dnalabs.kr/admin 에 들어올 수 있는 사람)를 더합니다.
#
#   bash add-operator.sh DNALABS admin
#   bash add-operator.sh DNALABS admin --빼기
#
# 이 스크립트는 계정을 **만들지 않습니다.** 이미 있는 계정을 운영자로
# 표시할 뿐입니다. 계정은 setup-admin.sh 로 먼저 만드세요.
#
# ⚠ 고객사 관리자를 운영자로 삼지 마세요.
#   BKT·ACTIVA·9DORO 의 admin 은 고객사 것입니다. 그 계정을 운영자로 두면
#   고객사가 우리 운영 화면에 들어와 남의 회사 목록을 보게 됩니다.
#   우리 계정은 DNALABS 회사 아래에 따로 두는 것이 맞습니다.
set -euo pipefail
cd "$(dirname "$0")/../Rebind"     # supabase CLI 가 link 되어 있는 곳

CODE="${1:-}"; LOGIN="${2:-}"; MODE="${3:-}"
if [ -z "$CODE" ] || [ -z "$LOGIN" ]; then
  echo "쓰는 법: bash add-operator.sh <회사코드> <아이디> [--빼기]"
  echo "  예:    bash add-operator.sh DNALABS admin"
  exit 1
fi
CODE="$(echo "$CODE" | tr '[:lower:]' '[:upper:]')"
LOGIN="$(echo "$LOGIN" | tr '[:upper:]' '[:lower:]')"

if [ "$MODE" = "--빼기" ]; then
  SQL="delete from public.operators where user_id = (
         select p.id from public.profiles p
         join public.companies c on c.id = p.company_id
         where c.code = '$CODE' and p.login_id = '$LOGIN')
       returning user_id;"
  DONE="뺐습니다"
else
  # 없는 계정이면 아무 줄도 안 들어갑니다 — 조용히 성공한 척하지 않게
  # returning 으로 결과를 받아 확인합니다.
  SQL="insert into public.operators (user_id, memo)
       select p.id, '$CODE/$LOGIN'
         from public.profiles p
         join public.companies c on c.id = p.company_id
        where c.code = '$CODE' and p.login_id = '$LOGIN'
       on conflict (user_id) do update set memo = excluded.memo
       returning user_id;"
  DONE="더했습니다"
fi

OUT="$(supabase db query --linked "$SQL" 2>&1)"
if echo "$OUT" | grep -q '"user_id"'; then
  echo "  ✓ $CODE / $LOGIN 을 운영자로 $DONE"
else
  echo "  ‼ 아무 줄도 바뀌지 않았습니다."
  echo "    그런 회사·아이디가 있는지 확인해 주세요:"
  supabase db query --linked \
    "select c.code, p.login_id, p.name from public.profiles p
       join public.companies c on c.id = p.company_id order by c.code, p.login_id" 2>&1 | tail -30
  exit 1
fi

echo
echo "  지금 운영자:"
supabase db query --linked \
  "select o.memo, p.name from public.operators o
     join public.profiles p on p.id = o.user_id order by o.memo" 2>&1 \
  | grep -E '"memo"|"name"' || echo "    (없음)"
