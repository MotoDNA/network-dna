/* ═══════════════════════════════════════════════════════════
   NETWORK DNA · 고객관리 — 구글 시트 연동 스크립트 (v2 · 로그인)

   바뀐 점
   - 회사 코드 + 아이디 + 비밀번호로 로그인합니다
   - 자격을 확인한 뒤에만 데이터를 내려줍니다
   - 모든 고객·기록이 회사 코드로 나뉘어 서로 보이지 않습니다

   처음 설치하면 편집기에서 초기설정() 을 한 번 실행하세요.
   회사 코드와 관리자 계정이 만들어집니다.
   ═══════════════════════════════════════════════════════════ */

var CUST_HEAD = ['uid','company','createdAt','name','co','title','phone','email','addr','groups','owner','shared','lastAt','updated','deleted'];
var CUST_KO   = ['고유번호','회사코드','등록일','성함','회사명','직함','전화번호','이메일','주소','그룹','담당자','공유','최근활동','수정시각','삭제'];

var ACT_HEAD  = ['uid','company','cid','kind','body','at','due','done','by','updated','deleted'];
var ACT_KO    = ['고유번호','회사코드','고객번호','유형','내용','일시','마감일','완료','작성자','수정시각','삭제'];

var USER_HEAD = ['company','id','name','hash','salt','rounds','role','disabled','newPw','fails','lockUntil','updated'];
var USER_KO   = ['회사코드','아이디','이름','비밀번호(암호화됨)','솔트','반복수','권한','사용중지','새 비밀번호 입력','실패횟수','잠금해제시각','수정시각'];

var COMP_HEAD = ['code','name','note','disabled','createdAt'];
var COMP_KO   = ['회사코드','회사명','메모','사용중지','만든날짜'];

var SESS_HEAD = ['token','company','id','expires'];
var SESS_KO   = ['토큰','회사코드','아이디','만료시각'];

var ROUNDS      = 3000;              // 비밀번호 해시 반복 횟수
var SESSION_DAY = 30;                // 로그인 유지 기간(일)
var MAX_FAIL    = 5;                 // 연속 실패 허용 횟수
var LOCK_MIN    = 10;                // 잠금 시간(분)

var KIND_KO = {
  '미팅':'meeting', '요청사항':'request', '요청':'request',
  '불만사항':'issue', '불만':'issue', '클레임':'issue',
  '특이사항':'note', '메모':'note',
  '제공 샘플':'sample', '제공샘플':'sample', '샘플':'sample',
  '할 일':'todo', '할일':'todo', '넥스트플랜':'todo'
};
var KIND_SET = {meeting:1, request:1, issue:1, note:1, sample:1, todo:1};
var DT_FULL = {createdAt:1, lastAt:1, at:1};
var DT_DAY  = {due:1};

/* ───────────────── 처음 한 번 실행 ───────────────── */
function 초기설정() {
  var comp = sheet_('Companies', COMP_HEAD, COMP_KO);
  var users = sheet_('Users', USER_HEAD, USER_KO);
  sheet_('Sessions', SESS_HEAD, SESS_KO);
  sheet_('Customers', CUST_HEAD, CUST_KO);
  sheet_('Timeline',  ACT_HEAD,  ACT_KO);

  var code = randomCode_();
  var pw   = randomPw_();
  var salt = Utilities.getUuid();
  var tz   = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  comp.appendRow(toRow_(COMP_HEAD, {
    code: code, name: '우리 회사', note: '회사명을 고쳐 주세요',
    disabled: 0, createdAt: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd')
  }));
  users.appendRow(toRow_(USER_HEAD, {
    company: code, id: 'admin', name: '관리자',
    hash: hashPw_(pw, salt, ROUNDS), salt: salt, rounds: ROUNDS,
    role: 'admin', disabled: 0, newPw: '', fails: 0, lockUntil: 0, updated: Date.now()
  }));

  // 예전 데이터가 있으면 이 회사 것으로 넘깁니다
  var moved = adoptOrphans_(code);

  var msg = '회사 코드 : ' + code + '\n' +
            '아이디    : admin\n' +
            '비밀번호  : ' + pw + '\n\n' +
            '앱 첫 화면에 이 세 가지를 넣으면 들어갑니다.\n' +
            '로그인한 뒤 비밀번호를 꼭 바꾸세요.' +
            (moved ? ('\n\n기존 데이터 ' + moved + '건을 이 회사로 옮겼습니다.') : '');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('초기 설정 완료', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return msg;
}

/* 회사 코드가 비어 있는 기존 행을 첫 회사 것으로 채웁니다 */
function adoptOrphans_(code) {
  var n = 0;
  [['Customers', CUST_HEAD, CUST_KO], ['Timeline', ACT_HEAD, ACT_KO]].forEach(function (t) {
    var sh = sheet_(t[0], t[1], t[2]);
    var last = sh.getLastRow();
    if (last < 3) return;
    var col = t[1].indexOf('company') + 1;
    var rng = sh.getRange(3, col, last - 2, 1);
    var v = rng.getValues();
    var changed = false;
    for (var i = 0; i < v.length; i++) {
      if (!String(v[i][0] || '').length) { v[i][0] = code; changed = true; n++ }
    }
    if (changed) rng.setValues(v);
  });
  return n;
}

function randomCode_() {
  var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 헷갈리는 글자 제외
  var s = '';
  for (var i = 0; i < 6; i++) s += A.charAt(Math.floor(Math.random() * A.length));
  return s;
}
function randomPw_() {
  var A = 'abcdefghijkmnpqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < 10; i++) s += A.charAt(Math.floor(Math.random() * A.length));
  return s;
}

/* ───────────────── 비밀번호 ───────────────── */
function hashPw_(pw, salt, rounds) {
  var v = String(salt) + '|' + String(pw);
  var r = Number(rounds) || ROUNDS;
  for (var i = 0; i < r; i++) {
    v = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v, Utilities.Charset.UTF_8));
  }
  return v;
}
/* 길이가 같아도 앞부분만 비교해 끝나지 않도록 전체를 훑습니다 */
function sameStr_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return d === 0;
}

/* ───────────────── 요청 처리 ───────────────── */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000) }
  catch (err) { return json_({ ok: false, error: '다른 요청 처리 중입니다. 잠시 후 다시 시도하세요.' }) }
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var act  = String(body.action || 'sync');

    if (act === 'ping')     return json_({ ok: true, version: 2 });
    if (act === 'login')    return json_(doLogin_(body));
    if (act === 'logout')   return json_(doLogout_(body));
    if (act === 'changePw') return json_(doChangePw_(body));
    if (act === 'sync')     return json_(doSync_(body));
    return json_({ ok: false, error: '알 수 없는 요청입니다: ' + act });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock() } catch (e2) {}
  }
}

function doGet() {
  return json_({ ok: true, version: 2,
    hint: 'NETWORK DNA 고객관리 서버입니다. 앱 첫 화면에 이 주소와 회사 코드·아이디·비밀번호를 넣어 주세요.' });
}

/* ───────────────── 로그인 ───────────────── */
function doLogin_(body) {
  var code = String(body.code || '').trim().toUpperCase();
  var id   = String(body.id || '').trim();
  var pw   = String(body.pw || '');
  if (!code || !id || !pw) return { ok: false, error: '회사 코드, 아이디, 비밀번호를 모두 넣어 주세요.' };

  var comp = findCompany_(code);
  if (!comp) return { ok: false, error: '회사 코드를 찾을 수 없습니다.' };
  if (Number(comp.disabled)) return { ok: false, error: '사용이 중지된 회사 코드입니다.' };

  var found = findUser_(code, id);
  if (!found) return { ok: false, error: '아이디 또는 비밀번호가 맞지 않습니다.' };
  var u = found.row, sh = found.sheet, rowNo = found.rowNo;

  if (Number(u.disabled)) return { ok: false, error: '사용이 중지된 계정입니다. 관리자에게 문의하세요.' };

  var now = Date.now();
  if (Number(u.lockUntil) > now) {
    var min = Math.ceil((Number(u.lockUntil) - now) / 60000);
    return { ok: false, error: '비밀번호를 여러 번 틀려 잠겼습니다. ' + min + '분 뒤에 다시 시도하세요.' };
  }

  var ok = String(u.hash).length && sameStr_(hashPw_(pw, u.salt, u.rounds), u.hash);
  if (!ok) {
    var fails = Number(u.fails || 0) + 1;
    var patch = { fails: fails, lockUntil: 0 };
    if (fails >= MAX_FAIL) { patch.lockUntil = now + LOCK_MIN * 60000; patch.fails = 0 }
    writeUser_(sh, rowNo, u, patch);
    return { ok: false, error: fails >= MAX_FAIL
      ? ('비밀번호를 ' + MAX_FAIL + '번 틀려 ' + LOCK_MIN + '분간 잠겼습니다.')
      : '아이디 또는 비밀번호가 맞지 않습니다.' };
  }
  writeUser_(sh, rowNo, u, { fails: 0, lockUntil: 0 });

  var token = newToken_();
  addSession_(token, code, id);
  return {
    ok: true, token: token, company: code, companyName: String(comp.name || ''),
    id: id, name: String(u.name || id), role: String(u.role || 'user'),
    members: listMembers_(code), now: Date.now()
  };
}

function doLogout_(body) {
  dropSession_(String(body.token || ''));
  return { ok: true };
}

function doChangePw_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;
  var oldPw = String(body.oldPw || ''), newPw = String(body.newPw || '');
  if (newPw.length < 8) return { ok: false, error: '새 비밀번호는 8자 이상으로 정해 주세요.' };

  var found = findUser_(s.company, s.id);
  if (!found) return { ok: false, error: '계정을 찾을 수 없습니다.' };
  var u = found.row;
  if (!sameStr_(hashPw_(oldPw, u.salt, u.rounds), u.hash)) {
    return { ok: false, error: '지금 쓰는 비밀번호가 맞지 않습니다.' };
  }
  var salt = Utilities.getUuid();
  writeUser_(found.sheet, found.rowNo, u,
    { salt: salt, rounds: ROUNDS, hash: hashPw_(newPw, salt, ROUNDS), newPw: '', updated: Date.now() });
  return { ok: true };
}

/* ───────────────── 토큰 ───────────────── */
function newToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Math.random().toString(36).slice(2, 8);
}
function addSession_(token, code, id) {
  var sh = sheet_('Sessions', SESS_HEAD, SESS_KO);
  sweepSessions_(sh);
  sh.appendRow(toRow_(SESS_HEAD,
    { token: token, company: code, id: id, expires: Date.now() + SESSION_DAY * 86400000 }));
}
function dropSession_(token) {
  if (!token) return;
  var sh = sheet_('Sessions', SESS_HEAD, SESS_KO);
  var rows = readAll_(sh, SESS_HEAD, 'token');
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i].token) === String(token)) sh.deleteRow(i + 3);
  }
}
/* 만료된 것을 치웁니다 (한 번에 너무 많이 지우지 않도록 뒤에서부터) */
function sweepSessions_(sh) {
  var rows = readAll_(sh, SESS_HEAD, 'token');
  var now = Date.now(), removed = 0;
  for (var i = rows.length - 1; i >= 0 && removed < 200; i--) {
    if (Number(rows[i].expires || 0) < now) { sh.deleteRow(i + 3); removed++ }
  }
}
function auth_(token) {
  token = String(token || '');
  if (!token) return { ok: false, auth: true, error: '로그인이 필요합니다.' };
  var sh = sheet_('Sessions', SESS_HEAD, SESS_KO);
  var rows = readAll_(sh, SESS_HEAD, 'token');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].token) === token) {
      if (Number(rows[i].expires || 0) < Date.now()) {
        return { ok: false, auth: true, error: '로그인이 만료되었습니다. 다시 들어와 주세요.' };
      }
      var u = findUser_(rows[i].company, rows[i].id);
      if (!u || Number(u.row.disabled)) {
        return { ok: false, auth: true, error: '사용할 수 없는 계정입니다.' };
      }
      return { ok: true, company: String(rows[i].company), id: String(rows[i].id),
               name: String(u.row.name || rows[i].id), role: String(u.row.role || 'user') };
    }
  }
  return { ok: false, auth: true, error: '로그인이 만료되었습니다. 다시 들어와 주세요.' };
}

/* ───────────────── 동기화 (로그인 확인 후) ───────────────── */
function doSync_(body) {
  var s = auth_(body.token);
  if (!s.ok) return s;

  var since = Number(body.since) || 0;
  var code  = s.company;

  var custRes = upsert_('Customers', CUST_HEAD, CUST_KO, body.cust || [], since, code, s);
  var actRes  = upsert_('Timeline',  ACT_HEAD,  ACT_KO,  body.act  || [], since, code, s, custRes.visibleSet);
  labelTimeline_(code);

  return {
    ok: true,
    cust: custRes.pull, act: actRes.pull,
    members: listMembers_(code),
    visible: custRes.visible,
    me: { id: s.id, name: s.name, role: s.role, company: code },
    totalCust: custRes.total, totalAct: actRes.total,
    now: Date.now()
  };
}

function upsert_(name, head, koHead, push, since, code, me, allowCids) {
  var sh   = sheet_(name, head, koHead);
  var rows = readAll_(sh, head);

  var idx = {};
  for (var i = 0; i < rows.length; i++) idx[String(rows[i].uid)] = i;

  var pushed = {}, appends = [];

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
    o.company = code;                       // 보낸 쪽 값을 믿지 않고 로그인한 회사로 고정합니다
    pushed[key] = true;

    if (idx[key] === undefined) {
      rows.push(o); idx[key] = rows.length - 1;
      appends.push(toRow_(head, o));
    } else {
      var i2 = idx[key];
      // 다른 회사 행은 건드릴 수 없습니다
      if (String(rows[i2].company || '') !== code) continue;
      if (Number(o.updated || 0) >= Number(rows[i2].updated || 0)) {
        rows[i2] = o;
        sh.getRange(i2 + 3, 1, 1, head.length).setValues([toRow_(head, o)]);
      }
    }
  }
  if (appends.length) {
    sh.getRange(sh.getLastRow() + 1, 1, appends.length, head.length).setValues(appends);
  }

  var pull = [], live = 0, visible = [], visibleSet = {};
  var isCust = (name === 'Customers');

  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    if (String(r.company || '') !== code) continue;      // 회사가 다르면 아예 제외

    var gone = Number(r.deleted) ? true : false;
    if (!gone) live++;

    var mine;
    if (isCust) {
      mine = canSee_(r, me);
      if (mine && !gone) { visible.push(String(r.uid)); visibleSet[String(r.uid)] = true }
    } else {
      mine = !allowCids || allowCids[String(r.cid)] === true;
    }
    if (!mine) continue;
    if (Number(r.updated || 0) > since && !pushed[String(r.uid)]) pull.push(r);
  }
  return { pull: pull, total: live, visible: visible, visibleSet: visibleSet };
}

/* 관리자는 회사 전체를 봅니다. 그 밖에는 담당이거나 공유받은 것만 봅니다. */
function canSee_(r, me) {
  if (me.role === 'admin') return true;
  var own = String(r.owner || '').trim();
  if (own === me.id || own === me.name) return true;
  var list = String(r.shared || '').split('|');
  for (var i = 0; i < list.length; i++) {
    var t = list[i].trim();
    if (t === me.id || t === me.name) return true;
  }
  return false;
}

function listMembers_(code) {
  var sh = sheet_('Users', USER_HEAD, USER_KO);
  var rows = readAll_(sh, USER_HEAD, 'id');
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r.company || '').trim() !== code) continue;
    if (Number(r.disabled)) continue;
    out.push({ id: String(r.id).trim(), name: String(r.name || r.id).trim(), role: String(r.role || 'user') });
  }
  return out;
}

function findCompany_(code) {
  var rows = readAll_(sheet_('Companies', COMP_HEAD, COMP_KO), COMP_HEAD, 'code');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].code || '').trim().toUpperCase() === code) return rows[i];
  }
  return null;
}
function findUser_(code, id) {
  var sh = sheet_('Users', USER_HEAD, USER_KO);
  var rows = readAll_(sh, USER_HEAD, 'id');
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].company || '').trim().toUpperCase() === String(code).toUpperCase() &&
        String(rows[i].id || '').trim() === String(id)) {
      return { row: rows[i], sheet: sh, rowNo: i + 3 };
    }
  }
  return null;
}
function writeUser_(sh, rowNo, row, patch) {
  for (var k in patch) row[k] = patch[k];
  sh.getRange(rowNo, 1, 1, USER_HEAD.length).setValues([toRow_(USER_HEAD, row)]);
}

/* ───────────────── 시트에서 직접 입력·수정했을 때 ─────────────────
   사람이 셀을 고치면 자동으로 실행됩니다.
   Users 탭에 새 비밀번호를 적으면 즉시 암호화하고 원래 칸을 지웁니다. */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    var name = sh.getName();
    if (['Customers', 'Timeline', 'Users'].indexOf(name) < 0) return;

    var head = name === 'Customers' ? CUST_HEAD : (name === 'Timeline' ? ACT_HEAD : USER_HEAD);
    var first = Math.max(3, e.range.getRow());
    var last  = e.range.getLastRow();
    if (last < 3) return;

    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    var stamp = Date.now();
    var only = onlyCompany_();
    var custIndex = (name === 'Timeline') ? buildCustIndex_(only) : null;

    for (var r = first; r <= last; r++) {
      var rng = sh.getRange(r, 1, 1, head.length);
      var v = rng.getValues()[0];

      var any = false;
      for (var c = 0; c < v.length; c++) {
        if (String(v[c] === null || v[c] === undefined ? '' : v[c]).length) { any = true; break }
      }
      if (!any) continue;

      var row = {};
      for (var k = 0; k < head.length; k++) row[head[k]] = v[k];

      if (name === 'Users') {
        var np = String(row.newPw || '').trim();
        if (np.length) {
          var salt = Utilities.getUuid();
          row.salt = salt; row.rounds = ROUNDS;
          row.hash = hashPw_(np, salt, ROUNDS);
          row.newPw = '';                       // 평문은 남기지 않습니다
          row.fails = 0; row.lockUntil = 0;
        }
        row.id = String(row.id || '').trim();
        row.company = String(row.company || '').trim().toUpperCase();
        if (!String(row.role || '').length) row.role = 'user';
        row.disabled = truthy_(row.disabled) ? 1 : 0;
        row.updated = stamp;
        rng.setValues([toRow_(head, row)]);
        continue;
      }

      normalize_(name, row, tz, custIndex);
      row.uid = String(row.uid || '').length ? row.uid : newUid_();
      // 회사 코드가 비어 있고 회사가 하나뿐이면 채워 줍니다
      if (!String(row.company || '').length && only) row.company = only;
      row.updated = stamp;

      rng.setValues([toRow_(head, row)]);
      rng.setNumberFormat('@');

      var cCol = head.indexOf('company') + 1;
      sh.getRange(r, cCol).setBackground(String(row.company || '').length ? null : '#FDEEF0');

      if (name === 'Timeline' && custIndex) {
        var bad = !String(row.cid || '').length || !custIndex.byUid[String(row.cid)];
        sh.getRange(r, head.indexOf('cid') + 1).setBackground(bad ? '#FDEEF0' : null);
      }
    }
    if (name === 'Timeline') labelTimeline_(only);
  } catch (err) {
    // 편집을 막지 않도록 조용히 넘어갑니다
  }
}

/* 회사가 하나뿐이면 그 코드를 돌려줍니다 (여럿이면 빈 값) */
function onlyCompany_() {
  var rows = readAll_(sheet_('Companies', COMP_HEAD, COMP_KO), COMP_HEAD, 'code');
  var live = rows.filter(function (r) { return !Number(r.disabled) });
  return live.length === 1 ? String(live[0].code).trim().toUpperCase() : '';
}

function normalize_(name, row, tz, custIndex) {
  var nowFull = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm");
  for (var f in DT_FULL) if (row[f] instanceof Date) row[f] = Utilities.formatDate(row[f], tz, "yyyy-MM-dd'T'HH:mm");
  for (var g in DT_DAY)  if (row[g] instanceof Date) row[g] = Utilities.formatDate(row[g], tz, 'yyyy-MM-dd');
  row.deleted = truthy_(row.deleted) ? 1 : 0;
  row.company = String(row.company || '').trim().toUpperCase();

  if (name === 'Customers') {
    if (!String(row.createdAt || '').length) row.createdAt = nowFull;
    if (!String(row.lastAt || '').length) row.lastAt = row.createdAt;
    row.groups = splitJoin_(row.groups);
    row.shared = splitJoin_(row.shared);
    row.phone = String(row.phone || '').trim();
  } else {
    var kind = String(row.kind || '').trim();
    row.kind = KIND_SET[kind] ? kind : (KIND_KO[kind] || 'meeting');
    if (!String(row.at || '').length) row.at = nowFull;
    row.done = (row.kind === 'todo' && truthy_(row.done)) ? 1 : 0;
    var cid = String(row.cid || '').trim();
    if (cid.length && custIndex && !custIndex.byUid[cid]) {
      var hit = custIndex.byName[cid] || custIndex.byPhone[onlyDigits_(cid)];
      if (hit) row.cid = hit;
    }
  }
}
function splitJoin_(v) {
  return String(v || '').split(/[|,\/]/)
    .map(function (t) { return t.trim() })
    .filter(function (t) { return t.length })
    .join('|');
}

function buildCustIndex_(code) {
  var rows = readAll_(sheet_('Customers', CUST_HEAD, CUST_KO), CUST_HEAD);
  var byUid = {}, byName = {}, byPhone = {}, dup = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (Number(r.deleted)) continue;
    if (code && String(r.company || '').trim().toUpperCase() !== code) continue;
    var u = String(r.uid);
    byUid[u] = r;
    var nm = String(r.name || '').trim();
    if (nm.length) { if (byName[nm] !== undefined) dup[nm] = true; byName[nm] = u }
    var ph = onlyDigits_(r.phone);
    if (ph.length >= 9) byPhone[ph] = u;
  }
  for (var n in dup) delete byName[n];
  return { byUid: byUid, byName: byName, byPhone: byPhone };
}

/* Timeline 옆에 고객 이름을 적어 사람이 읽을 수 있게 합니다 */
function labelTimeline_(code) {
  try {
    var sh = sheet_('Timeline', ACT_HEAD, ACT_KO);
    var last = sh.getLastRow();
    if (last < 3) return;
    var col = ACT_HEAD.length + 1;
    sh.getRange(1, col).setValue('고객명(자동)').setFontWeight('bold').setBackground('#E8F3FF');
    sh.getRange(2, col).setValue('(참고용)').setFontColor('#8B95A1').setFontSize(9);

    var idx = buildCustIndex_('');
    var cids = sh.getRange(3, ACT_HEAD.indexOf('cid') + 1, last - 2, 1).getValues();
    var out = [];
    for (var i = 0; i < cids.length; i++) {
      var c = idx.byUid[String(cids[i][0])];
      out.push([c ? (String(c.name || '') + (c.co ? ' · ' + c.co : '')) : '']);
    }
    sh.getRange(3, col, out.length, 1).setValues(out);
  } catch (err) {}
}

/* ───────────────── 시트 유틸 ───────────────── */
function sheet_(name, head, koHead) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getMaxColumns() < head.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  }
  if (sh.getLastRow() < 2) {
    sh.clear(); writeHead_(sh, head, koHead); sh.setColumnWidth(1, 130);
    return sh;
  }
  var cur = sh.getRange(2, 1, 1, head.length).getValues()[0];
  var same = true;
  for (var i = 0; i < head.length; i++) {
    if (String(cur[i]).trim() !== head[i]) { same = false; break }
  }
  if (!same) writeHead_(sh, head, koHead);
  return sh;
}
function writeHead_(sh, head, koHead) {
  sh.getRange(1, 1, 1, head.length).setValues([koHead]).setFontWeight('bold').setBackground('#E8F3FF');
  sh.getRange(2, 1, 1, head.length).setValues([head]).setFontColor('#8B95A1').setFontSize(9);
  sh.setFrozenRows(2);
}
function readAll_(sh, head, keyField) {
  var last = sh.getLastRow();
  if (last < 3) return [];
  var vals = sh.getRange(3, 1, last - 2, head.length).getValues();
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var o = {};
    for (var k = 0; k < head.length; k++) {
      var key = head[k], v = vals[i][k];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, DT_DAY[key] ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm");
      o[key] = (v === null || v === undefined) ? '' : v;
    }
    if (String(o[keyField || 'uid'] || '').length) out.push(o);
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
function onlyDigits_(v) { return String(v === null || v === undefined ? '' : v).replace(/[^0-9]/g, '') }
function truthy_(v) {
  if (v === true) return true;
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'y' || s === 'yes' ||
         s === '완료' || s === '삭제' || s === 'o' || s === '예';
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
