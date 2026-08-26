/* ═══════════════════════════════════════════════════════════
   NETWORK DNA · 고객관리 — 구글 시트 연동 스크립트

   1) doPost  : 폰 ↔ 시트 양방향 동기화
   2) onEdit  : 시트에서 사람이 직접 입력·수정한 것을 폰으로 보냅니다
                (고유번호·수정시각을 자동으로 채워 줍니다)

   설치 방법은 구글시트-연동방법.md 참고.
   ═══════════════════════════════════════════════════════════ */

var CUST_HEAD = ['uid','createdAt','name','company','title','phone','email','addr','groups','owner','lastAt','updated','deleted'];
var ACT_HEAD  = ['uid','cid','kind','body','at','due','done','by','updated','deleted'];

var CUST_KO = ['고유번호','등록일','성함','회사명','직함','전화번호','이메일','주소','그룹','담당자','최근활동','수정시각','삭제'];
var ACT_KO  = ['고유번호','고객번호','유형','내용','일시','마감일','완료','작성자','수정시각','삭제'];

/* 사람이 한글로 적어도 알아듣도록 */
var KIND_KO = {
  '미팅':'meeting', '요청사항':'request', '요청':'request',
  '불만사항':'issue', '불만':'issue', '클레임':'issue',
  '특이사항':'note', '메모':'note',
  '제공 샘플':'sample', '제공샘플':'sample', '샘플':'sample',
  '할 일':'todo', '할일':'todo', '넥스트플랜':'todo'
};
var KIND_SET = {meeting:1, request:1, issue:1, note:1, sample:1, todo:1};

/* 날짜·시각이 들어가는 칸 (사람이 입력하면 시트가 날짜값으로 바꿔 버리므로 글자로 되돌립니다) */
var DT_FULL = {createdAt:1, lastAt:1, at:1};   // 2026-08-26T14:30
var DT_DAY  = {due:1};                          // 2026-08-26

/* ───────────────── 폰 ↔ 시트 동기화 ───────────────── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); }
  catch (err) { return json_({ ok: false, error: '다른 요청 처리 중입니다. 잠시 후 다시 시도하세요.' }); }
  try {
    var body  = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var since = Number(body.since) || 0;

    var custRes = upsert_('Customers', CUST_HEAD, CUST_KO, body.cust || [], since);
    var actRes  = upsert_('Timeline',  ACT_HEAD,  ACT_KO,  body.act  || [], since);
    labelTimeline_();

    return json_({
      ok: true,
      cust: custRes.pull,
      act: actRes.pull,
      totalCust: custRes.total,
      totalAct: actRes.total,
      now: Date.now()
    });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (err2) {}
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

  var pushed = {}, appends = [];

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
      // 시트 쪽이 더 최신이면 덮어쓰지 않습니다 (시트에서 고친 내용을 지키기 위해)
      if (Number(o.updated || 0) >= Number(rows[i2].updated || 0)) {
        rows[i2] = o;
        sh.getRange(i2 + 3, 1, 1, head.length).setValues([toRow_(head, o)]);
      }
    }
  }

  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, head.length).setValues(appends);
  }

  var pull = [], live = 0;
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    if (!Number(r.deleted)) live++;
    if (Number(r.updated || 0) > since && !pushed[String(r.uid)]) pull.push(r);
  }
  return { pull: pull, total: live };
}

/* ───────────────── 시트에서 직접 입력·수정했을 때 ─────────────────
   사람이 셀을 고치면 자동으로 실행됩니다.
   고유번호가 없으면 새로 만들고, 수정시각을 지금으로 찍어서
   앱이 다음 동기화(최대 20초) 때 가져가도록 합니다.
   ※ 스크립트가 쓴 값에는 반응하지 않으므로 무한 반복이 생기지 않습니다. */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    var name = sh.getName();
    if (name !== 'Customers' && name !== 'Timeline') return;

    var head = (name === 'Customers') ? CUST_HEAD : ACT_HEAD;
    var first = Math.max(3, e.range.getRow());
    var last  = e.range.getLastRow();
    if (last < 3) return;

    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    var stamp = Date.now();
    var custIndex = (name === 'Timeline') ? buildCustIndex_() : null;

    for (var r = first; r <= last; r++) {
      var rng = sh.getRange(r, 1, 1, head.length);
      var v = rng.getValues()[0];

      // 완전히 빈 줄은 건너뜁니다
      var any = false;
      for (var c = 0; c < v.length; c++) {
        if (String(v[c] === null || v[c] === undefined ? '' : v[c]).length) { any = true; break }
      }
      if (!any) continue;

      var row = {};
      for (var k = 0; k < head.length; k++) row[head[k]] = v[k];

      normalize_(name, row, tz, custIndex);
      row.uid = String(row.uid || '').length ? row.uid : newUid_();
      row.updated = stamp;

      rng.setValues([toRow_(head, row)]);
      rng.setNumberFormat('@');   // 날짜로 자동 변환되는 것을 막습니다

      if (name === 'Timeline') {
        // 고객번호를 못 찾았으면 빨갛게 표시해 둡니다
        var bad = !String(row.cid || '').length || !custIndex.byUid[String(row.cid)];
        sh.getRange(r, 2).setBackground(bad ? '#FDEEF0' : null);
      }
    }
    if (name === 'Timeline') labelTimeline_();
  } catch (err) {
    // 편집을 막지 않도록 조용히 넘어갑니다
  }
}

/* 입력값 다듬기 — 한글 유형, 쉼표로 쓴 그룹, 날짜 등을 앱이 쓰는 형태로 */
function normalize_(name, row, tz, custIndex) {
  var nowFull = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm");

  for (var f in DT_FULL) if (row[f] instanceof Date) row[f] = Utilities.formatDate(row[f], tz, "yyyy-MM-dd'T'HH:mm");
  for (var g in DT_DAY)  if (row[g] instanceof Date) row[g] = Utilities.formatDate(row[g], tz, 'yyyy-MM-dd');

  row.deleted = truthy_(row.deleted) ? 1 : 0;

  if (name === 'Customers') {
    if (!String(row.createdAt || '').length) row.createdAt = nowFull;
    if (!String(row.lastAt   || '').length) row.lastAt   = row.createdAt;
    // 그룹은 | 로 구분합니다. 쉼표·슬래시로 적어도 알아서 바꿔 줍니다.
    row.groups = String(row.groups || '').split(/[|,\/]/)
      .map(function (s) { return s.trim() })
      .filter(function (s) { return s.length })
      .join('|');
    row.phone = String(row.phone || '').trim();
  } else {
    var kind = String(row.kind || '').trim();
    row.kind = KIND_SET[kind] ? kind : (KIND_KO[kind] || 'meeting');
    if (!String(row.at || '').length) row.at = nowFull;
    row.done = (row.kind === 'todo' && truthy_(row.done)) ? 1 : 0;
    // 고객번호 칸에 고객 이름이나 전화번호를 적어도 찾아 줍니다
    var cid = String(row.cid || '').trim();
    if (cid.length && !custIndex.byUid[cid]) {
      var hit = custIndex.byName[cid] || custIndex.byPhone[onlyDigits_(cid)];
      if (hit) row.cid = hit;
    }
  }
}

function buildCustIndex_() {
  var sh = sheet_('Customers', CUST_HEAD, CUST_KO);
  var rows = readAll_(sh, CUST_HEAD);
  var byUid = {}, byName = {}, byPhone = {}, dupName = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (Number(r.deleted)) continue;
    var u = String(r.uid);
    byUid[u] = r;
    var nm = String(r.name || '').trim();
    if (nm.length) {
      if (byName[nm] !== undefined) dupName[nm] = true;   // 동명이인은 자동으로 못 고릅니다
      byName[nm] = u;
    }
    var ph = onlyDigits_(r.phone);
    if (ph.length >= 9) byPhone[ph] = u;
  }
  for (var n in dupName) delete byName[n];
  return { byUid: byUid, byName: byName, byPhone: byPhone };
}

/* Timeline 옆에 고객 이름을 적어 사람이 읽을 수 있게 합니다 (동기화에는 쓰이지 않는 참고 칸) */
function labelTimeline_() {
  try {
    var sh = sheet_('Timeline', ACT_HEAD, ACT_KO);
    var last = sh.getLastRow();
    if (last < 3) return;
    var col = ACT_HEAD.length + 1;
    sh.getRange(1, col).setValue('고객명(자동)').setFontWeight('bold').setBackground('#E8F3FF');
    sh.getRange(2, col).setValue('(참고용)').setFontColor('#8B95A1').setFontSize(9);

    var idx = buildCustIndex_();
    var cids = sh.getRange(3, 2, last - 2, 1).getValues();
    var out = [];
    for (var i = 0; i < cids.length; i++) {
      var c = idx.byUid[String(cids[i][0])];
      out.push([c ? (String(c.name || '') + (c.company ? ' · ' + c.company : '')) : '']);
    }
    sh.getRange(3, col, out.length, 1).setValues(out);
  } catch (err) {}
}

/* ───────────────── 시트 유틸 ───────────────── */
/* 1행 = 사람이 보는 한글 머리글, 2행 = 프로그램이 쓰는 키, 3행부터 데이터 */
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
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var o = {};
    for (var k = 0; k < head.length; k++) {
      var key = head[k], v = vals[i][k];
      if (v instanceof Date) {
        v = Utilities.formatDate(v, tz, DT_DAY[key] ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm");
      }
      o[key] = (v === null || v === undefined) ? '' : v;
    }
    if (String(o.uid || '').length) out.push(o);
  }
  return out;
}

function toRow_(head, o) {
  var r = [];
  for (var i = 0; i < head.length; i++) {
    var v = o[head[i]];
    r.push((v === undefined || v === null) ? '' : v);
  }
  return r;
}

function newUid_() {
  return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36);
}

function onlyDigits_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/[^0-9]/g, '');
}

function truthy_(v) {
  if (v === true) return true;
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'y' || s === 'yes' ||
         s === '완료' || s === '삭제' || s === 'o' || s === '예';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
