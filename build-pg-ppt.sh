#!/usr/bin/env bash
# 토스페이먼츠 심사에 낼 결제경로 PPT 를 처음부터 다시 만듭니다.
#   여섯 장을 운영 사이트에서 찍고 → PPT 로 묶습니다.
# 화면 문구를 고쳤으면 이것만 다시 돌리면 됩니다.
set -euo pipefail
# 변수 이름은 영어로 둡니다 — 한글 변수 이름은 bash 판에 따라 명령으로 읽혀 멈춥니다(2026-10).
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "‼ Google Chrome 이 필요합니다"; exit 1; }

WORK="$(mktemp -d)"; SHOTDIR="$WORK/shots"; mkdir -p "$SHOTDIR"
cleanup(){ pkill -f "remote-debugging-port=9777" 2>/dev/null || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$CHROME" --headless=new --remote-debugging-port=9777 --no-first-run \
  --user-data-dir="$WORK/chrome" about:blank >/dev/null 2>&1 &
sleep 4
node shoot-pg.mjs 9777 "$SHOTDIR"

# python-pptx 는 시스템 파이썬에 못 넣습니다(PEP 668). 딸린 자리를 하나 만들어 씁니다.
[ -d "$WORK/venv" ] || python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install --quiet python-pptx
SHOTS="$SHOTDIR" OUT="$PWD/토스페이먼츠_결제경로.pptx" "$WORK/venv/bin/python" make-pg-ppt.py
