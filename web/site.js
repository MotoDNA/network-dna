/* 홈페이지가 서버와 주고받는 것 — 셋뿐입니다.
     ① 방문 세기      ② 운영 화면에서 고친 글 갈아 끼우기     ③ 문의 보내기
   dnalabs.kr 의 모든 쪽이 이 파일 하나를 씁니다. 쪽마다 따로 두면
   한 쪽만 고쳐 놓고 나머지를 잊습니다. */
(function () {
  'use strict';
  var FN = 'https://izrtclsqhsgkuwsffifn.supabase.co/functions/v1/site';
  var KEY = 'sb_publishable_G5wx-YdgwUU630x1vKmZmQ_15BgxvEX';

  function 부르기(body) {
    return fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json() });
  }

  /* ── ① 방문 세기 ──
     날짜 × 경로별 횟수만 올립니다. 누가 왔는지는 안 보냅니다 —
     쿠키도 기기표시도 없어서 개인정보가 아니고, 그래서 동의창이 없습니다.
     실패해도 조용히 넘어갑니다. 통계 때문에 쪽이 느려지면 안 됩니다. */
  try {
    var 길 = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    부르기({ action: 'hit', path: 길 || '/' }).catch(function () {});
  } catch (e) {}

  /* ── ② 운영 화면에서 고친 글 ──
     HTML 에 적힌 글이 원본입니다. 여기서 받아 온 값이 있을 때만 갈아 끼웁니다.
     ⚠ 검색엔진은 원본을 봅니다 — 이건 사람에게만 보이는 덧칠입니다. */
  부르기({ action: 'copy' }).then(function (j) {
    if (!j || !j.ok || !j.copy) return;
    var c = j.copy;

    // 알림 띠 — 값이 있을 때만 만듭니다
    if (c['site.notice'] && c['site.notice'].trim()) {
      var 띠 = document.createElement('div');
      띠.className = 'notice';
      띠.textContent = c['site.notice'];
      document.body.insertBefore(띠, document.body.firstChild);
    }
    // 이름표를 달아 둔 자리만 갈아 끼웁니다
    Object.keys(c).forEach(function (k) {
      document.querySelectorAll('[data-copy="' + k + '"]').forEach(function (el) {
        if (c[k] && c[k].trim()) el.textContent = c[k];
      });
    });
  }).catch(function () {});

  /* ── ③ 문의 ── */
  document.querySelectorAll('form[data-ask]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var 말 = form.querySelector('.msg');
      var 단추 = form.querySelector('button[type=submit]');
      var 값 = function (n) { var el = form.querySelector('[name=' + n + ']'); return el ? el.value.trim() : '' };

      말.className = 'msg';
      말.textContent = '';
      if (!form.querySelector('[name=agreed]').checked) {
        말.className = 'msg bad';
        말.textContent = '개인정보 수집·이용에 동의해 주셔야 보낼 수 있습니다.';
        return;
      }
      단추.disabled = true;
      var 옛 = 단추.textContent;
      단추.textContent = '보내는 중…';

      부르기({
        action: 'inquiry', agreed: true,
        name: 값('name'), company: 값('company'), contact: 값('contact'),
        want: 값('want'), people: 값('people'), message: 값('message'),
        website: 값('website'),                       // 사람에게는 안 보이는 칸
        source: location.pathname.replace(/\.html$/, '') || '/'
      }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.error) || '보내지 못했습니다.');
        form.innerHTML =
          '<div class="done"><h3>보냈습니다</h3>' +
          '<p>영업일 기준 하루 안에 답을 드립니다.<br>' +
          '급하시면 <b>010-6451-5807</b> 로 전화 주세요.</p></div>';
      }).catch(function (err) {
        말.className = 'msg bad';
        말.textContent = err.message || '보내지 못했습니다. hello@dnalabs.kr 로 보내 주세요.';
        단추.disabled = false;
        단추.textContent = 옛;
      });
    });
  });
})();
