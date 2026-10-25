// 토스페이먼츠 심사에 낼 **결제 경로** 화면을 찍습니다.
//
// 토스 「홈페이지 결제경로 제작 가이드(정기결제용)」를 그대로 따릅니다.
//   · 모든 화면에 **주소창(도메인)** 과 **PC 시계**가 보여야 합니다
//     → 숨은 크롬(headless)으로 찍으면 둘 다 없습니다. 진짜 크롬 창을 띄우고
//       macOS `screencapture` 로 화면 전체를 찍습니다(맨 위 막대에 시계).
//   · 빌링은 **정기결제용 카드 입력창**(카드번호·유효기간·생년월일)까지 찍어야 합니다
//     → 숨은 크롬에서는 토스 창이 "알 수 없는 에러(UNKNOWN)" 로 뜨지 않았습니다.
//       2026-10 에 낸 파일이 그래서 다시 요청받았습니다. 진짜 창에서는 뜹니다.
//
// 손으로 그린 그림을 내면 화면이 바뀌는 순간 거짓말이 됩니다.
// 운영 중인 dnalabs.kr 을 그대로 띄워 찍습니다. 값을 지어 넣은 '가입 완료' 화면은 찍지 않습니다.
//
//   node shoot-pg.mjs <포트> <나올폴더>
//   (build-pg-ppt.sh 가 크롬 창을 띄운 뒤 부릅니다)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';

const [PORT, OUT] = process.argv.slice(2);
const 문 = 'https://dnalabs.kr';
const 열쇠 = 'tosspay2026';
// 시험할 때만: 화면 기록 권한이 없는 곳에서 흐름만 확인합니다(주소창·시계는 안 찍힘)
const 속찍기 = process.env.PG_SHOT_INNER === '1';

const 목록 = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const 첫탭 = 목록.find(t => t.type === 'page');
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, { once: true }));

let n = 0;
const 기다리는것 = new Map(), 이벤트 = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && 기다리는것.has(m.id)) { 기다리는것.get(m.id)(m); 기다리는것.delete(m.id) }
  if (m.method && 이벤트.has(m.method)) { 이벤트.get(m.method)(); 이벤트.delete(m.method) }
});
function 보내기(method, params = {}, sessionId) {
  const id = ++n;
  return new Promise(ok => {
    기다리는것.set(id, m => ok(m.result));
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
const 사건기다리기 = (name, ms) => Promise.race([
  new Promise(ok => 이벤트.set(name, ok)),
  new Promise(ok => setTimeout(ok, ms)),
]);
const 잠깐 = ms => new Promise(ok => setTimeout(ok, ms));

// 새 탭을 열지 않고 처음 떠 있는 탭을 씁니다 — 탭줄에 빈 탭이 남지 않게
const { sessionId: sid } = await 보내기('Target.attachToTarget', { targetId: 첫탭.id, flatten: true });
await 보내기('Page.enable', {}, sid);
await 보내기('Runtime.enable', {}, sid);

async function 가기(url, 틈 = 2500) {
  await 보내기('Page.navigate', { url }, sid);
  await 사건기다리기('Page.loadEventFired', 20000);
  await 잠깐(틈);
}
async function 시키기(code) {
  const r = await 보내기('Runtime.evaluate',
    { expression: code, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' — ' + code.slice(0, 80));
  return r.result?.value;
}

/* 누를 곳에 파란 테두리를 둘러 둡니다 — 토스 예시 파일처럼, 어디를 보고 넘어가는지 보이게.
   화면 내용은 건드리지 않고 테두리만 얹습니다. */
const 테두리 = 고르개 => 시키기(`(() => {
  document.querySelectorAll('[data-pg-mark]').forEach(e => { e.style.outline = ''; e.removeAttribute('data-pg-mark') });
  ${고르개 ? `const el = document.querySelector(${JSON.stringify(고르개)});
  if (el) { el.setAttribute('data-pg-mark',''); el.style.outline = '4px solid #2F6BFF'; el.style.outlineOffset = '4px'; }` : ''}
  return 'ok'; })()`);

const 쪽들 = [];
async function 찍기(이름, 제목, 주소, 설명) {
  const 길 = `${OUT}/${이름}.png`;
  await 보내기('Page.bringToFront', {}, sid);
  await 잠깐(700);
  if (속찍기) {
    const { data } = await 보내기('Page.captureScreenshot', { format: 'png' }, sid);
    await fs.writeFile(길, Buffer.from(data, 'base64'));
  } else {
    try { execFileSync('screencapture', ['-x', 길]) } catch {}
    const 크기 = await fs.stat(길).then(s => s.size).catch(() => 0);
    if (!크기) {
      console.error('\n‼ 화면을 찍지 못했습니다. macOS 가 화면 기록을 막고 있습니다.');
      console.error('  시스템 설정 → 개인정보 보호 및 보안 → 화면 및 시스템 오디오 기록 → 「터미널」을 켜고');
      console.error('  터미널을 완전히 껐다 켠 뒤 다시 돌려 주세요.\n');
      process.exit(2);
    }
  }
  쪽들.push({ 파일: 이름, 제목, 주소, 설명 });
  console.log('  ✓', 이름);
}

console.log('결제 경로를 찍습니다 — 끝날 때까지(1분쯤) 마우스·키보드를 건드리지 말아 주세요');

// ② 하단 정보 — 홈페이지 맨 아래
await 가기(문 + '/');
await 시키기(`window.scrollTo(0, document.body.scrollHeight); 'ok'`);
await 잠깐(900);
await 테두리('footer .legal');
await 찍기('02-하단정보', '② 하단 정보', 'https://dnalabs.kr',
  '상호명 · 대표자명 · 사업자등록번호 · 통신판매업신고번호 · 사업장 주소 · 대표번호 · 이메일을 홈페이지와 가입(결제) 화면 하단에 표시합니다.');

// ③ 환불 규정 — 청약철회와 환불(제3조)부터
await 가기(문 + '/refund.html');
await 시키기(`(() => { const h = [...document.querySelectorAll('h2')].find(x => x.textContent.includes('제3조'));
  if (h) window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 90); return 'ok'; })()`);
await 잠깐(900);
await 테두리(null);
await 찍기('03-환불규정', '③ 환불 규정', 'https://dnalabs.kr/refund.html',
  '무형 상품(월 구독)의 청약철회 · 전액 환불(결제일로부터 7일 이내)과 중도 해지 기준을 공개합니다. 모든 페이지 하단의 「환불정책」에서 열립니다.');

// ④ 로그인 / 회원가입
await 가기(문 + '/reservice', 3500);
await 테두리(null);
await 찍기('04a-로그인', '④ 로그인', 'https://dnalabs.kr/reservice',
  '가입하신 회사코드 · 아이디 · 비밀번호로 로그인합니다. 처음 오신 분은 회원가입으로 들어갑니다.');

await 가기(문 + '/signup?review=' + 열쇠, 3000);
await 테두리(null);
await 찍기('04b-회원가입', '④ 회원가입 시작', 'https://dnalabs.kr/signup',
  '회원가입은 업종 확인부터 시작합니다. 가입과 정기결제 카드 등록이 한 흐름으로 이어집니다.');

// ⑤ 상품 선택 / 구매 과정
await 가기(문 + '/reservice-guide.html#price', 3000);
await 시키기(`(() => { const t = document.getElementById('price'); if (t) t.scrollIntoView({block:'start'}); return 'ok'; })()`);
await 잠깐(900);
await 테두리('#price table');
await 찍기('05a-요금안내', '⑤ 상품 안내 · 요금', 'https://dnalabs.kr/reservice-guide.html',
  '서비스별 · 인원 구간별 월 요금을 공개합니다. 모든 금액은 부가세 별도입니다.');

await 가기(문 + '/signup?review=' + 열쇠, 3000);
await 시키기(`S.industryId = 'mfg'; go(1); 'ok'`);
await 잠깐(1200);
await 테두리('#panel');
await 찍기('05b-요금제선택', '⑤ 요금제 선택', 'https://dnalabs.kr/signup',
  '요금제를 고르면 월 요금(부가세 포함 금액)과 첫 청구 시점을 그 자리에서 보여 줍니다.');

// 화면이 S 에 적힌 값으로 칸을 그립니다. 칸에 직접 넣으면 다시 그릴 때 지워집니다.
await 시키기(`S.planKey = 'personal'; S.seats = 1;
  S.company = '디엔에이랩스'; S.name = '담당자'; S.email = 'hello@dnalabs.kr'; S.phone = '010-6451-5807';
  go(2); 'ok'`);
await 잠깐(1000);
await 테두리('#panel');
await 찍기('05c-정보입력', '⑤ 가입 정보 입력', 'https://dnalabs.kr/signup',
  '상호 · 담당자 · 이메일 · 연락처를 받습니다.');

await 시키기(`S.agreed = {tos:true, privacy:true, billing:true, market:true, oversea:true}; go(3); 'ok'`);
await 잠깐(1000);
await 테두리('#panel');
await 찍기('05d-약관동의', '⑤ 약관 동의', 'https://dnalabs.kr/signup',
  '이용약관 · 개인정보 수집·이용 · 정기결제(자동결제) 동의를 받습니다. 필수 항목에 동의해야 다음으로 넘어갑니다.');

await 시키기(`go(4); 'ok'`);
await 잠깐(1200);
await 시키기(`(() => { const b = document.getElementById('paybtn'); if (b) b.scrollIntoView({block:'center'}); return 'ok'; })()`);
await 잠깐(900);
await 테두리('#paybtn');
await 찍기('05e-결제직전', '⑤ 결제 수단 등록', 'https://dnalabs.kr/signup',
  '요금제 · 월 요금 · 첫 청구일을 다시 보여 드린 뒤, 「카드 등록하고 가입 마치기」를 누르면 토스페이먼츠 정기결제 카드 입력창이 열립니다.');

// ⑥ 카드 결제 경로 — 토스페이먼츠 정기결제용 카드 입력창
await 테두리(null);
/* 코드로 .click() 하면 토스가 "알 수 없는 에러(UNKNOWN)" 를 냅니다 — 사람이 누른 것이
   아니라서입니다. 마우스를 그 자리에 실제로 눌렀다 떼는 것처럼 보냅니다. */
// 부드러운 스크롤이 도는 중에 자리를 재면 엉뚱한 곳을 누릅니다. 멈춘 뒤에 잽니다.
await 시키기(`document.getElementById('paybtn').scrollIntoView({ block: 'center', behavior: 'instant' }); 'ok'`);
await 잠깐(1200);
const 자리 = await 시키기(`(() => { const b = document.getElementById('paybtn').getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
  await 보내기('Input.dispatchMouseEvent',
    { type, x: 자리.x, y: 자리.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 }, sid);
  await 잠깐(80);
}
console.log('  … 토스 카드 입력창을 기다립니다');
let 떴나 = false;
for (let i = 0; i < 30 && !떴나; i++) {
  await 잠깐(1000);
  떴나 = await 시키기(`!![...document.querySelectorAll('iframe')].find(f => /tosspayments/.test(f.src) && f.getBoundingClientRect().width > 200)`);
}
await 잠깐(4000);   // 창 안의 칸이 다 그려질 때까지
const 오류 = await 시키기(`(document.getElementById('payerr') || {}).textContent || ''`);
if (!떴나 || 오류.trim()) {
  console.error('\n‼ 토스 카드 입력창이 뜨지 않았습니다.', 오류.trim());
  console.error('  확장 프로그램이 없는 새 창에서 띄우므로 대개는 됩니다. 한 번 더 돌려 주세요.\n');
  process.exit(3);
}
await 찍기('06-카드입력창', '⑥ 카드 결제 경로 — 정기결제용 카드 입력창', 'https://dnalabs.kr/signup → 토스페이먼츠',
  '카드번호 · 유효기간 · 생년월일(주민등록번호 앞자리)은 토스페이먼츠 창에서만 입력받습니다. 당사는 카드번호를 받거나 저장하지 않고, 빌링키만 돌려받습니다.');

await fs.writeFile(`${OUT}/pages.json`, JSON.stringify(쪽들, null, 2));
ws.close();
console.log('끝났습니다 →', OUT);
