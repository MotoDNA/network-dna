#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 개인정보 처리방침을 network-dna.html 에서 뽑아 두 벌 만듭니다.
#   · 고객사 전달용 PDF   (바탕화면 Re-Call 문서/)
#   · 홈페이지용 web/privacy.html
#
# 방침 문구를 여기에 베껴 쓰지 않습니다. 앱이 실제로 화면에 그리는
# privacyHTML() 을 원본에서 읽어와 그대로 실행해 씁니다.
# CSS 도 앱의 <style> 블록을 그대로 씁니다.
# 따라서 network-dna.html 만 고치면 PDF 는 다시 만들기만 하면 됩니다.
#
#   ./make-privacy-pdf.sh              → "고객사" 로 (일반 배포용)
#   ./make-privacy-pdf.sh 액티바코리아  → 그 회사 이름을 넣어서
#
# 자리표시자([담당자명] 등)가 남아 있으면 파일 이름에 _초안 이 붙습니다.
# 미완성 방침을 고객사에 그대로 보내는 일을 막기 위한 것입니다.
# ─────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

SRC="network-dna.html"
OUTDIR="$HOME/Desktop/Re-Call 문서"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
COMPANY="${1:-}"

[ -f "$SRC" ]   || { echo "‼ $SRC 을 찾을 수 없습니다"; exit 1; }
[ -x "$CHROME" ] || { echo "‼ Google Chrome 이 필요합니다 (PDF 생성에 씁니다)"; exit 1; }
mkdir -p "$OUTDIR"

TMPHTML="$(mktemp -t recall-priv-XXXXXX).html"
# 회사 이름을 넣은 판은 홈페이지에 올리지 않습니다 (일반 배포용만)
WEBOUT=""; [ -z "$COMPANY" ] && WEBOUT="web/privacy.html"

WEBOUT="$WEBOUT" COMPANY="$COMPANY" SRC="$SRC" OUT="$TMPHTML" node <<'NODE'
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(process.env.SRC, 'utf8');

/* ── 원본에서 필요한 조각만 떼어 옵니다 ── */
function styleBlock(){
  const a = src.indexOf('<style>'), b = src.indexOf('</style>', a);
  if (a < 0 || b < 0) throw new Error('<style> 블록을 찾지 못했습니다');
  return src.slice(a + 7, b);
}
function oneLiner(re, what){
  const m = src.match(re);
  if (!m) throw new Error(what + ' 정의를 찾지 못했습니다');
  return m[0];
}
/* 함수는 여는 줄부터 열 0 의 } 까지. 이 파일의 서식이 그렇습니다. */
function fnSource(name){
  const head = 'function ' + name + '(){';
  const a = src.indexOf(head);
  if (a < 0) throw new Error(name + ' 을 찾지 못했습니다');
  const b = src.indexOf('\n}', a);
  if (b < 0) throw new Error(name + ' 의 끝을 찾지 못했습니다');
  return src.slice(a, b + 2);
}

const css       = styleBlock();
const escSrc    = oneLiner(/^const esc=.*$/m, 'esc');
const revSrc    = oneLiner(/^const PRIVACY_REV\s*=\s*'[^']*';$/m, 'PRIVACY_REV');
const privSrc   = fnSource('privacyHTML');

/* 내가 덧쓰는 클래스가 앱 CSS 에 이미 있으면 멈춥니다.
   .sheet 를 그냥 썼다가 PDF 가 통째로 빈 종이로 나온 적이 있습니다.
   (.sheet 는 화면 밖에 세워 두는 바텀시트였습니다) */
for (const cls of ['pdfdoc','doctitle']) {
  if (new RegExp('\\.' + cls + '[\\s{,:.]').test(css)) {
    throw new Error('클래스 이름 .' + cls + ' 가 앱 CSS 에 이미 있습니다. 다른 이름을 쓰세요.');
  }
}


/* ── 앱과 똑같은 조건으로 실행합니다 ── */
const company = process.env.COMPANY || '';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  'const me = ' + (company ? JSON.stringify({ companyName: company }) : 'null') + ';\n'
  + escSrc + '\n' + revSrc + '\n' + privSrc + '\n'
  + 'globalThis.__out = privacyHTML();\n'
  + 'globalThis.__rev = PRIVACY_REV;',
  sandbox
);
const body = sandbox.__out;
const rev  = sandbox.__rev;

/* ── 자리표시자가 남아 있는지 ── */
const holes = (body.match(/\[[^\]<>]{2,40}\]/g) || []);

const page = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>Re:Call 개인정보 처리방침</title>
<style>${css}</style>
<style>
  /* 종이에 맞추는 부분만 덧씁니다. 위 CSS 는 앱 것 그대로입니다. */
  @page { size: A4; margin: 18mm 15mm 16mm; }
  html { font-size: 15px; }
  body { background:#fff; }
  .pdfdoc { max-width:none; padding:0; }
  .doctitle { font-size:1.35rem; font-weight:800; letter-spacing:-.03em;
              color:var(--ink); margin:0 0 2px; }
  /* 시행일 줄은 privacyHTML() 이 이미 .upd 로 찍습니다. 여기서 또 찍지 않습니다. */
  .priv .upd { margin:0 0 22px; padding-bottom:14px;
               border-bottom:1px solid var(--line); }
  .priv h3  { break-after:avoid; page-break-after:avoid; }
  .tblx, .priv li { break-inside:avoid; page-break-inside:avoid; }
  .priv p   { orphans:2; widows:2; }
  /* 앱은 라벨 칸이 88px 인데, 종이에서는 "개인정보 보호책임자" 가
     "자" 한 글자만 다음 줄로 떨어집니다. 인쇄용으로만 넓힙니다. */
  .tblx div { grid-template-columns:140px 1fr; }
</style>
</head><body><div class="pdfdoc">
<p class="doctitle">개인정보 처리방침</p>
${body}
</div></body></html>`;

fs.writeFileSync(process.env.OUT, page);
fs.writeFileSync(process.env.OUT + '.holes', holes.join('\n'));

/* 홈페이지용 — 같은 본문에 사이트 껍데기만 입힙니다.
   방침 문구를 여기에 또 적지 않는 것이 핵심입니다. */
if (process.env.WEBOUT) {
  const nav = `<nav class="nav"><div class="wrap">
  <a href="index.html" class="logo">DNA <b>Labs</b></a>
  <div class="navlinks"><a href="recall.html">Re:Call 소개</a><a href="terms.html">이용약관</a><a href="refund.html">환불정책</a></div>
</div></nav>`;
  const web = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>개인정보 처리방침 · Re:Call</title>
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="style.css">
</style>
</head><body>
${nav}
<div class="legalwrap">
<h1 style="margin-bottom:18px">개인정보 처리방침</h1>
${body}
</div>
</body></html>`;
  fs.writeFileSync(process.env.WEBOUT, web);
}
console.log('· 방침 본문 ' + body.length + '자를 privacyHTML() 에서 뽑았습니다 (시행일 ' + rev + ')');
NODE

HOLES="$(cat "$TMPHTML.holes")"
# 회사 이름을 넣어 만든 것이 일반 배포용을 덮어쓰지 않도록 이름을 나눕니다.
BASE="Re-Call_개인정보_처리방침"
[ -n "$COMPANY" ] && BASE="${BASE}_${COMPANY}"
[ -n "$HOLES" ]   && BASE="${BASE}_초안"
PDF="$OUTDIR/$BASE.pdf"

"$CHROME" --headless --disable-gpu --no-sandbox \
  --virtual-time-budget=12000 --no-pdf-header-footer \
  --print-to-pdf="$PDF" "file://$TMPHTML" >/dev/null 2>&1

[ -f "$PDF" ] || { echo "‼ PDF 생성 실패. 중간 HTML: $TMPHTML"; exit 1; }
echo "✓ $PDF  ($(du -h "$PDF" | cut -f1))"

if [ -n "$HOLES" ]; then
  cat <<MSG

⚠ 아직 채워지지 않은 자리표시자가 있어 파일 이름에 _초안 을 붙였습니다:

$(echo "$HOLES" | sed 's/^/     /')

   network-dna.html 의 privacyHTML() 안 "8. 문의처" 를 채운 뒤
   이 스크립트를 다시 돌리면 _초안 없는 이름으로 나옵니다.
   (개인정보 보호법상 보호책임자 정보는 필수 기재사항입니다)
MSG
fi
echo
[ -n "$WEBOUT" ] && echo "✓ $WEBOUT"
echo
echo "   중간 HTML: $TMPHTML"
