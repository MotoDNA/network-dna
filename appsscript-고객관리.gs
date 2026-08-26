/* ═══════════════════════════════════════════════════════════
   NETWORK DNA · 고객관리 — 구글 시트 연동 스크립트
   시트 두 개(Customers / Timeline)를 자동으로 만들고 관리합니다.
   설치 방법은 구글시트-연동방법.md 참고.
   ═══════════════════════════════════════════════════════════ */

var CUST_HEAD = ['uid','createdAt','name','company','title','phone','email','addr','groups','owner','lastAt','updated','deleted'];
var ACT_HEAD  = ['uid','cid','kind','body','at','due','done','by','updated','deleted'];

var CUST_KO = ['고유번호','등록일','성함','회사명','직함','전화번호','이메일','주소','그룹','담당자','최근활동','수정시각','삭제'];
var ACT_KO  = ['고유번호','고객번호','유형','내용','일시','마감일','완료','작성자','수정시각','삭제'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (err) { return json_({ ok: false, error: '다른 요청 처리 중입니다. 잠시 후 다시 시도하세요.' }); }
  try {
    var body  = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var since = Number(body.since) || 0;

    var custRes = upsert_('Customers', CUST_HEAD, CUST_KO, body.cust || [], since);
    var actRes  = upsert_('Timeline',  ACT_HEAD,  ACT_KO,  body.act  || [], since);

    return json_({
      ok: true,
      cust: custRes.pull,
      act: actRes.pull,
      totalCust: custRes.total,
      totalAct: actRes.total,
      now: Date.now()
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

function doGet() {
  return json_({ ok: true, hint: 'NETWORK DNA 고객관리 동기화 서버입니다. 앱 설정 화면에 이 주소를 넣어주세요.' });
}

function upsert_(name, head, koHead, push, since) {
  var sh   = sheet_(name, head, koHead);
  var rows = readAll_(sh, head);

  var idx = {};
  for (var i = 0; i < rows.length; i++) idx[String(rows[i].uid)] = i;

  var pushed  = {};
  var appends = [];

  // 같은 uid가 한 요청에 두 번 들어오면 마지막 것만 씁니다.
  var uniq = {}, order = [];
  for (var d = 0; d < push.length; d++) {
    var it = push[d];
    if (!it || !it.uid) continue;
    var uk = String(it.uid);
    if (uniq[uk] === undefined) order.push(uk);
    uniq[uk] = it;
  }

  for (var p = 0; p < order.length; p++) {
    var key = order[p];
    var o = uniq[key];
    pushed[key] = true;

    if (idx[key] === undefined) {
      rows.push(o);
      idx[key] = rows.length - 1;
      appends.push(toRow_(head, o));
    } else {
      var i2 = idx[key];
      // 시트 쪽이 더 최신이면 덮어쓰지 않습니다.
      if (Number(o.updated || 0) >= Number(rows[i2].updated || 0)) {
        rows[i2] = o;
        sh.getRange(i2 + 3, 1, 1, head.length).setValues([toRow_(head, o)]);
      }
    }
  }

  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, head.length).setValues(appends);
  }

  var pull = [];
  var live = 0;
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    if (!Number(r.deleted)) live++;
    if (Number(r.updated || 0) > since && !pushed[String(r.uid)]) pull.push(r);
  }
  return { pull: pull, total: live };
}

/* 1행 = 한글 안내 머리글(사람이 보는 용도), 2행 = 실제 키 머리글 */
function sheet_(name, head, koHead) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() < 2) {
    sh.clear();
    sh.getRange(1, 1, 1, head.length).setValues([koHead])
      .setFontWeight('bold').setBackground('#E8F3FF');
    sh.getRange(2, 1, 1, head.length).setValues([head])
      .setFontColor('#8B95A1').setFontSize(9);
    sh.setFrozenRows(2);
    sh.setColumnWidth(1, 130);
  }
  return sh;
}

function readAll_(sh, head) {
  var last = sh.getLastRow();
  if (last < 3) return [];
  var vals = sh.getRange(3, 1, last - 2, head.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var o = {};
    for (var k = 0; k < head.length; k++) o[head[k]] = vals[i][k];
    if (String(o.uid || '').length) out.push(o);
  }
  return out;
}

function toRow_(head, o) {
  var r = [];
  for (var i = 0; i < head.length; i++) {
    var v = o[head[i]];
    r.push(v === undefined || v === null ? '' : v);
  }
  return r;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
