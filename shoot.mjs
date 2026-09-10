// 크롬에게 "화면은 390px, 해상도는 2배" 라고 직접 시켜서 찍습니다.
//
// 왜 이렇게까지 하나:
//   `--window-size=390,844 --screenshot` 은 **거짓말을 합니다.** 맥에서는 창이
//   500px 밑으로 안 내려가서 화면은 500px 로 짜 놓고 그림만 390px 로 잘라 냅니다.
//   오른쪽이 잘린 채로요. 게다가 `--force-device-scale-factor` 를 함께 주면
//   창 크기 지시 자체가 무시됩니다. 뿌리에 zoom 을 걸어 봐도 미디어쿼리는
//   그대로 780px 로 읽혀서 PC 배치가 나옵니다.
//
//   크롬 안쪽(DevTools Protocol)의 Emulation.setDeviceMetricsOverride 는
//   그 제한을 안 받습니다. 폰이라고 알려 주면 미디어쿼리까지 폰으로 읽습니다.
//
// 부르는 쪽: build-shots.sh
//   node shoot.mjs <포트> <나온파일1> <넣을html1> [<나온파일2> <넣을html2> ...]

const [PORT, ...pairs] = process.argv.slice(2);
const 폭 = 390, 높이 = 844, 배율 = 2;

const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise(ok => ws.addEventListener('open', ok, {once:true}));

let n = 0;
const 기다리는것 = new Map();      // 보낸 물음 → 답을 기다리는 자리
const 이벤트 = new Map();          // 사건 이름 → 그 사건을 기다리는 자리
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && 기다리는것.has(m.id)) { 기다리는것.get(m.id)(m); 기다리는것.delete(m.id) }
  if (m.method && 이벤트.has(m.method)) { 이벤트.get(m.method)(); 이벤트.delete(m.method) }
});
function 보내기(method, params = {}, sessionId) {
  const id = ++n;
  return new Promise(ok => {
    기다리는것.set(id, m => ok(m.result));
    ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
  });
}
const 사건기다리기 = (name, ms) => Promise.race([
  new Promise(ok => 이벤트.set(name, ok)),
  new Promise(ok => setTimeout(ok, ms)),
]);
const 잠깐 = ms => new Promise(ok => setTimeout(ok, ms));

const fs = await import('node:fs/promises');

for (let i = 0; i < pairs.length; i += 2) {
  const [out, html] = [pairs[i], pairs[i + 1]];
  const {targetId} = await 보내기('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await 보내기('Target.attachToTarget', {targetId, flatten: true});

  await 보내기('Page.enable', {}, sessionId);
  // mobile:true 를 줘야 미디어쿼리까지 폰으로 읽습니다. 이걸 빼면 폭만 좁은 PC 가 됩니다.
  await 보내기('Emulation.setDeviceMetricsOverride',
    {width: 폭, height: 높이, deviceScaleFactor: 배율, mobile: true}, sessionId);

  await 보내기('Page.navigate', {url: 'file://' + html}, sessionId);
  await 사건기다리기('Page.loadEventFired', 8000);
  await 잠깐(1400);          // 앱이 시작 코드를 돌리고 화면을 채울 틈 (주입은 400ms 뒤)

  const {data} = await 보내기('Page.captureScreenshot', {format: 'png'}, sessionId);
  await fs.writeFile(out, Buffer.from(data, 'base64'));
  await 보내기('Target.closeTarget', {targetId});

  const {size} = await fs.stat(out);
  console.log(`  ✓ ${out}  (${Math.round(size / 1024)}K)`);
}
ws.close();
