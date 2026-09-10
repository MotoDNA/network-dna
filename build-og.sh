#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 링크를 카카오톡·슬랙에 붙였을 때 보이는 공유 이미지(og:image)를 만듭니다.
#
#   web/og-dnalabs.png   회사 홈페이지용
#   web/og-recall.png    Re:Call 소개용
#
# 1200×630 은 카카오·페이스북·슬랙이 공통으로 쓰는 크기입니다.
# 문구를 고치려면 아래 HTML 을 고치고 다시 돌리세요.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "‼ Google Chrome 이 필요합니다"; exit 1; }

[ -f web/logo.png ] || { echo "‼ web/logo.png 이 없습니다. make-logo.py 를 먼저 돌리세요"; exit 1; }

shot(){ # 1=출력파일 2=HTML
  # 임시 HTML 을 web/ 안에 만듭니다. /tmp 에 두면 카드 안에서 logo.png 를
  # 상대 주소로 못 찾습니다 — 크롬이 /tmp 를 기준으로 찾기 때문입니다.
  local tmp="web/.og-tmp.html"
  printf '%s' "$2" > "$tmp"
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --virtual-time-budget=6000 --window-size=1200,630 \
    --screenshot="$1" "file://$PWD/$tmp" >/dev/null 2>&1
  rm -f "$tmp"
  echo "  ✓ $1  ($(du -h "$1" | cut -f1))"
}

BASE='<meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;
       padding:0 88px;font-family:Pretendard,-apple-system,sans-serif;letter-spacing:-.04em;
       background:#fff;color:#191F28}
  .tag{display:inline-block;align-self:flex-start;font-size:24px;font-weight:700;
       color:#3182F6;background:#E8F3FF;padding:10px 22px;border-radius:999px;margin-bottom:34px}
  h1{font-size:76px;font-weight:800;line-height:1.22}
  p{font-size:30px;color:#4E5968;line-height:1.55;margin-top:26px;letter-spacing:-.03em}
  .foot{position:absolute;bottom:56px;left:88px;display:flex;align-items:center;gap:14px}
  .mark{width:46px;height:46px;border-radius:50%;
        background:url(logo.png) center/contain no-repeat}
  .nm{font-size:26px;font-weight:800;letter-spacing:-.05em}
  .nm b{color:#3182F6}
  .bar{position:absolute;top:0;left:0;right:0;height:9px;background:#3182F6}
</style>'

shot "web/og-dnalabs.png" "$BASE"'
<div class="bar"></div>
<span class="tag">DNA Labs</span>
<h1>쓰는 사람이 있는<br>소프트웨어를 만듭니다</h1>
<p>웹사이트 · 모바일 앱 · 업무 소프트웨어</p>
<div class="foot"><div class="mark"></div><span class="nm">DNA <b>Labs</b></span></div>'

shot "web/og-recall.png" "$BASE"'
<div class="bar"></div>
<span class="tag">Re:Call · 고객관리</span>
<h1>“저번에 뭐라고<br>하셨더라”가 없어집니다</h1>
<p>명함을 찍으면 고객카드가 됩니다 · 개인 한 달 무료</p>
<div class="foot"><div class="mark"></div><span class="nm">DNA <b>Labs</b></span></div>'
