#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 홈페이지에 넣을 **실제 사용 화면** 을 찍습니다 (모바일 390×844, 2배 해상도).
#
# 그림을 손으로 그리지 않고 진짜 앱을 띄워 찍는 이유:
#   손으로 그리면 화면이 바뀔 때마다 그림이 거짓말이 됩니다.
#   여기서 찍으면 앱을 고친 뒤 다시 돌리기만 하면 됩니다.
#
# 자료는 예시입니다. 다만 연락처·주소·사업자번호는 **우리 것**을 넣습니다 —
# 남의 번호를 예시로 박아 두면 그 사람에게 전화가 갑니다.
#
# ⚠ 크롬의 `--screenshot` 은 쓰지 않습니다. 맥에서는 창이 500px 밑으로
#   안 내려가서, 화면은 500px 로 짜 놓고 그림만 390px 로 잘라 냅니다.
#   오른쪽이 잘린 그림이 나옵니다. 자세한 것은 shoot.mjs 머리말에.
#
#   ./build-shots.sh          → web/shot-*.png
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "‼ Google Chrome 이 필요합니다"; exit 1; }

# 경로는 이 스크립트가 있는 자리에서 잽니다. 위에서 이미 그리로 옮겨 왔습니다.
# 절대경로를 박아 두었다가 폴더가 통째로 옮겨지면서 세 앱을 다 못 찾은 적이 있습니다.
# 그때 조용히 깨지지 않도록 아래에서 하나씩 있는지 확인합니다.
UP="$(dirname "$PWD")"    # 형제 저장소들이 있는 자리
BIND="$UP/Rebind/bindery.html"
CALL="$PWD/network-dna.html"
STORE="$UP/Restore/store.html"

for f in "$BIND" "$CALL" "$STORE"; do
  [ -f "$f" ] || { echo "‼ 앱 파일을 찾을 수 없습니다: $f"; exit 1; }
done

PORT=9333
PROFILE="$(mktemp -d)"
TMPDIR_SHOT="web/.shots"
mkdir -p "$TMPDIR_SHOT"

# 앱 파일에 예시 자료를 넣은 임시본을 만듭니다.
# web/ 안에 두는 이유: 앱이 같은 폴더의 파일을 상대주소로 찾을 수도 있어서입니다.
ARGS=()
for f in shots/*.js; do
  name="$(basename "$f" .js)"
  case "$name" in
    bind-*)  app="$BIND"  ;;
    call-*)  app="$CALL"  ;;
    store-*) app="$STORE" ;;
    *) echo "  건너뜀 $name (앱을 못 고름)"; continue ;;
  esac
  tmp="$TMPDIR_SHOT/$name.html"
  python3 - "$app" "$f" "$tmp" <<'PY'
import io,sys
app,inj,out=sys.argv[1],sys.argv[2],sys.argv[3]
s=io.open(app,encoding='utf-8').read()
js=io.open(inj,encoding='utf-8').read()
# 앱의 시작 코드가 먼저 돌고(로그인 화면이 뜹니다) 그 뒤에 우리가 화면을 채웁니다
s=s.replace('</body>', '<script>setTimeout(function(){\n'+js+'\n},400);</script>\n</body>',1)
io.open(out,'w',encoding='utf-8').write(s)
PY
  ARGS+=("$PWD/web/shot-$name.png" "$PWD/$tmp")
done

"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --remote-debugging-port=$PORT --user-data-dir="$PROFILE" about:blank >/dev/null 2>&1 &
CHROME_PID=$!
# 크롬이 아직 프로필에 쓰고 있을 수 있어 조금 기다렸다 지웁니다
trap 'kill $CHROME_PID 2>/dev/null || true; sleep 1; rm -rf "$PROFILE" "$TMPDIR_SHOT" 2>/dev/null || true' EXIT

for _ in $(seq 40); do
  curl -sf "http://127.0.0.1:$PORT/json/version" >/dev/null && break
  sleep 0.25
done

node shoot.mjs "$PORT" "${ARGS[@]}"

# ── 홈페이지에 얹기 좋게 줄입니다 ──
# 찍을 때는 780px(2배)로 받아야 글자가 안 뭉갭니다. 그런데 홈페이지에서는
# 폰 그림 안에 212px 로 보여 주니, 그대로 올리면 여섯 장에 750KB 입니다.
# 폰으로 들어온 사람이 그걸 다 내려받습니다.
# 520px 이면 3배 화면에서도 여유가 있고, 색은 사실상 UI 색 몇 가지뿐이라
# 128색으로 줄여도 눈에 차이가 없습니다.
python3 - <<'PY2'
import glob, os
from PIL import Image
전, 후 = 0, 0
for p in sorted(glob.glob('web/shot-*.png')):
    전 += os.path.getsize(p)
    im = Image.open(p).convert('RGB')
    w = 520
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.quantize(colors=128, method=Image.FASTOCTREE).save(p, optimize=True)
    후 += os.path.getsize(p)
print('  줄였습니다: %dKB → %dKB' % (전/1024, 후/1024))
PY2
