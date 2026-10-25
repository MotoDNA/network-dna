#!/usr/bin/env bash
# 토스페이먼츠 심사에 낼 결제경로 PPT 를 처음부터 다시 만듭니다.
#   진짜 크롬 창을 띄워 운영 사이트를 한 단계씩 넘기며 화면 전체를 찍고 → PPT 로 묶습니다.
#
# ⚠ 반드시 **터미널 앱에서** 직접 돌립니다. 처음 한 번 macOS 가 「화면 기록」 허락을 묻습니다.
#   (주소창과 PC 시계가 보여야 한다는 토스 가이드 때문에 화면 전체를 찍습니다)
#   도는 동안(1분쯤) 마우스·키보드를 건드리지 마세요 — 창이 가려지면 그대로 찍힙니다.
#
# 테스트 계정을 표지에 적으려면:
#   PG_TEST_ID='회사코드 DEMO / 아이디 demo' PG_TEST_PW='비밀번호' ./build-pg-ppt.sh
#   (비밀번호는 파일에 남기지 않습니다. 만든 PPT 도 공개 저장소에 올리지 마세요)
set -euo pipefail
# 변수 이름은 영어로 둡니다 — 한글 변수 이름은 bash 판에 따라 명령으로 읽혀 멈춥니다(2026-10).
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "‼ Google Chrome 이 필요합니다"; exit 1; }

WORK="$(mktemp -d)"; SHOTDIR="$WORK/shots"; mkdir -p "$SHOTDIR"
cleanup(){ pkill -f "remote-debugging-port=9777" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT

# 화면 크기에 꼭 맞게 창을 띄웁니다. 새 프로필이라 즐겨찾기 막대·확장 프로그램이 없습니다.
BOUNDS="$(osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null || echo '0, 0, 1440, 900')"
SW="$(echo "$BOUNDS" | awk -F', ' '{print $3}')"; SH="$(echo "$BOUNDS" | awk -F', ' '{print $4}')"
"$CHROME" --remote-debugging-port=9777 --no-first-run --no-default-browser-check \
  --user-data-dir="$WORK/chrome" --window-position=0,0 --window-size="$SW,$SH" \
  --lang=ko about:blank >/dev/null 2>&1 &
# 크롬이 뜨는 데 5초 넘게 걸리기도 합니다. 문이 열릴 때까지 기다립니다.
for i in $(seq 1 30); do curl -s http://127.0.0.1:9777/json/version >/dev/null && break; sleep 1; done
sleep 2
node shoot-pg.mjs 9777 "$SHOTDIR"

# python-pptx 는 시스템 파이썬에 못 넣습니다(PEP 668). 딸린 자리를 하나 만들어 씁니다.
[ -d "$WORK/venv" ] || python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install --quiet python-pptx
SHOTS="$SHOTDIR" OUT="$PWD/토스페이먼츠_결제경로.pptx" "$WORK/venv/bin/python" make-pg-ppt.py
open -R "$PWD/토스페이먼츠_결제경로.pptx" 2>/dev/null || true
