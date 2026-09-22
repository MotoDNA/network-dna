// 토스페이먼츠 심사에 낼 **결제 경로** 여섯 장을 찍습니다.
//
// 손으로 그린 그림을 내면 화면이 바뀌는 순간 거짓말이 됩니다.
// 운영 중인 dnalabs.kr 을 그대로 띄워 찍습니다.
//
//   1 메인  2 요금 안내  3 요금제 선택  4 정보 입력  5 토스 결제창  6 가입 완료
//
// 6번은 실제 카드 등록을 마쳐야 나오는 화면입니다. 여기서는 우리 화면을
// 그대로 그리되 회사코드·비밀번호는 **예시**를 넣습니다.
// 진짜 비밀번호를 문서에 박아 넣을 수는 없습니다.
//
//   node shoot-pg.mjs <포트> <나올폴더>

const [PORT, OUT] = process.argv.slice(2);
const 폭 = 1280, 높이 = 900, 배율 = 2;
const 문 = 'https://dnalabs.kr';
const 열쇠 = 'tosspay2026';

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
const fs = await import('node:fs/promises');

async function 새창() {
  const { targetId } = await 보내기('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await 보내기('Target.attachToTarget', { targetId, flatten: true });
  await 보내기('Page.enable', {}, sessionId);
  await 보내기('Runtime.enable', {}, sessionId);
  await 보내기('Emulation.setDeviceMetricsOverride',
    { width: 폭, height: 높이, deviceScaleFactor: 배율, mobile: false }, sessionId);
  return { targetId, sessionId };
}
async function 가기(sid, url, 틈 = 2200) {
  await 보내기('Page.navigate', { url }, sid);
  await 사건기다리기('Page.loadEventFired', 15000);
  await 잠깐(틈);
}
async function 시키기(sid, code) {
  const r = await 보내기('Runtime.evaluate',
    { expression: code, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' — ' + code.slice(0, 60));
  return r.result?.value;
}
async function 찍기(sid, 이름) {
  const { data } = await 보내기('Page.captureScreenshot', { format: 'png' }, sid);
  await fs.writeFile(`${OUT}/${이름}.png`, Buffer.from(data, 'base64'));
  console.log('  ✓', 이름);
}

const { targetId, sessionId: sid } = await 새창();

console.log('결제 경로를 찍습니다');

// 1 · 메인
await 가기(sid, 문 + '/');
await 찍기(sid, '1-메인');

// 2 · 요금 안내
await 가기(sid, 문 + '/reservice');
await 시키기(sid, `(() => { const t = document.getElementById('picks') || document.querySelector('#ptab,.ptabwrap'); if (t) t.scrollIntoView({block:'center'}); })()`);
await 잠깐(900);
await 찍기(sid, '2-요금안내');

// 3~6 · 가입 흐름
await 가기(sid, 문 + '/signup?review=' + 열쇠, 2600);

// 3 · 요금제 선택 — 업종을 고른 상태에서 다음 화면
await 시키기(sid, `S.industryId = 'mfg'; go(1); 'ok'`);
await 잠깐(900);
await 찍기(sid, '3-요금제선택');

// 4 · 정보 입력 — 적어 넣은 모습으로
await 시키기(sid, `
  S.planKey = 'personal'; S.seats = 1; go(2);
  const 넣기 = (i, v) => { const el = document.querySelectorAll('.f input')[i]; if (el) el.value = v; };
  넣기(0, '디엔에이랩스'); 넣기(1, '담당자'); 넣기(2, 'hello@dnalabs.kr'); 넣기(3, '010-6451-5807');
  'ok'`);
await 잠깐(700);
await 찍기(sid, '4-정보입력');

// 5 · 토스 결제창 — 진짜로 띄웁니다
await 시키기(sid, `S.agreed = {tos:true, privacy:true, billing:true, market:true, oversea:true}; go(4); 'ok'`);
await 잠깐(700);
await 시키기(sid, `document.getElementById('paybtn').click(); 'ok'`);
console.log('  … 토스 결제창을 기다립니다 (20초)');
await 잠깐(20000);
await 찍기(sid, '5-토스결제창');

// 6 · 가입 완료 — 우리 화면 그대로, 값만 예시
await 가기(sid, 문 + '/signup?review=' + 열쇠, 2600);
await 시키기(sid, `
  S.planKey = 'personal'; S.seats = 1;
  S.result = { companyCode: '482913', loginId: 'admin', password: '예시-실제값은-한-번만-보입니다',
               trialEndsAt: '2026-10-22' };
  go(5); 'ok'`);
await 잠깐(900);
await 찍기(sid, '6-가입완료');

await 보내기('Target.closeTarget', { targetId });
ws.close();
console.log('끝났습니다 →', OUT);
