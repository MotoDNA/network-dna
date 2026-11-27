/* 디엔에이랩스 홈페이지 — 메뉴 · 포트폴리오(가로 넘김, 점토 반응) · 명함 날리기 · 상담 신청 */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 위쪽 로고 영상: 3초마다 한 번씩 되풀이. 움직임 줄이기를 켠 사람에게는 멈춘 그림만 보여 줍니다. */
  var logoV = $(".logo-v");
  if (logoV) { if (reduce) { logoV.removeAttribute("autoplay"); logoV.pause(); } else { var pl = logoV.play(); if (pl && pl.catch) pl.catch(function () {}); } }

  /* ── 1. 메뉴 ── */
  var hd = $("#hd"), nav = $("#nav"), menuBtn = $("#menuBtn");
  function closeMenu() { nav.classList.remove("is-open"); menuBtn.setAttribute("aria-expanded", "false"); menuBtn.setAttribute("aria-label", "메뉴 열기"); }
  menuBtn.addEventListener("click", function () {
    var open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("scroll", function () { hd.classList.toggle("is-scrolled", window.scrollY > 8); }, { passive: true });

  /* 지금 보고 있는 구역을 메뉴에 표시 */
  var links = $$('a[href^="#"]', nav);
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute("href") === "#" + e.target.id;
          a.classList.toggle("is-now", on);
          if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["about", "philosophy", "portfolio", "ai", "contact"].forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ── 2. 포트폴리오 ── */
  var tabs = $$("#portfolio .tab"), panes = $$(".pane"), bar = $("#pfBar"), prev = $("#pfPrev"), next = $("#pfNext");
  function track() { var p = panes.filter(function (x) { return !x.hidden; })[0]; return $(".track", p); }
  function updateBar() {
    var t = track(), max = t.scrollWidth - t.clientWidth;
    var view = Math.min(1, t.clientWidth / t.scrollWidth), pos = max > 0 ? t.scrollLeft / max : 0;
    bar.style.width = (view * 100) + "%";
    bar.style.marginLeft = (pos * (1 - view) * 100) + "%";
    prev.disabled = t.scrollLeft <= 2; next.disabled = t.scrollLeft >= max - 2;
  }
  function selectTab(i, focus) {
    tabs.forEach(function (b, k) {
      var on = k === i;
      b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      panes[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
    track().scrollLeft = 0; updateBar();
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () { selectTab(i); });
    b.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); selectTab((i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length, true); }
    });
  });
  function step(dir) { var t = track(), w = $(".work", t).getBoundingClientRect().width + 32; t.scrollBy({ left: dir * w, behavior: reduce ? "auto" : "smooth" }); }
  prev.addEventListener("click", function () { step(-1); });
  next.addEventListener("click", function () { step(1); });

  $$(".track").forEach(function (t) {
    t.addEventListener("scroll", updateBar, { passive: true });
    /* 마우스 휠(세로)을 가로 넘김으로 — 끝에 닿으면 페이지가 다시 내려갑니다 */
    t.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;        // 트랙패드 가로 넘김은 그대로
      var max = t.scrollWidth - t.clientWidth;
      var atStart = t.scrollLeft <= 1, atEnd = t.scrollLeft >= max - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      e.preventDefault();
      t.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
    }, { passive: false });
    /* 마우스로 잡아 끌기 */
    var down = false, sx = 0, sl = 0, moved = false;
    t.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse" || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = t.scrollLeft; });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; t.classList.add("is-drag"); }
      if (moved) t.scrollLeft = sl - dx;
    });
    window.addEventListener("pointerup", function () { if (!down) return; down = false; setTimeout(function () { t.classList.remove("is-drag"); }, 0); });
    t.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    t.addEventListener("keydown", function (e) { if (e.target !== t) return; if (e.key === "ArrowRight") { e.preventDefault(); step(1); } if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); } });
  });
  window.addEventListener("resize", updateBar);
  updateBar();

  /* 점토처럼 말랑하게: 마우스 쪽으로 기울고 눌리며, 떼면 통통 튑니다 */
  $$(".clay").forEach(function (c) {
    function set(tx, ty, sx, sy) { c.style.setProperty("--tx", tx + "deg"); c.style.setProperty("--ty", ty + "deg"); c.style.setProperty("--sx", sx); c.style.setProperty("--sy", sy); }
    c.addEventListener("pointerenter", function (e) { if (e.pointerType === "touch") return; c.classList.add("is-hover"); });
    c.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch" || reduce) return;
      var r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.style.setProperty("--mx", (px * 100) + "%"); c.style.setProperty("--my", (py * 100) + "%");
      var dx = px - .5, dy = py - .5, press = c.classList.contains("is-press");
      set((-dy * 9).toFixed(2), (dx * 9).toFixed(2), (press ? .95 : 1.045 + Math.abs(dx) * .03).toFixed(3), (press ? 1.03 : 1.045 - Math.abs(dx) * .03).toFixed(3));
    });
    c.addEventListener("pointerdown", function () { if (reduce) return; c.classList.remove("is-jelly"); c.classList.add("is-press"); set(0, 0, .94, 1.035); });
    function release(jelly) {
      var was = c.classList.contains("is-press");
      c.classList.remove("is-press"); set(0, 0, 1, 1);
      if (was && jelly && !reduce) { c.classList.add("is-jelly"); }
    }
    c.addEventListener("pointerup", function () { release(true); });
    c.addEventListener("pointercancel", function () { release(false); });
    c.addEventListener("pointerleave", function () { c.classList.remove("is-hover"); release(false); });
    c.addEventListener("animationend", function () { c.classList.remove("is-jelly"); });
  });

  /* ── 3. 명함: 누르면 양탄자처럼 한 바퀴 날아 제자리로 ── */
  var bcBtn = $("#bcBtn"), bc = $("#bc"), shadow = $(".bc-shadow"), flying = false;
  bcBtn.addEventListener("click", function () {
    if (flying) return;
    if (reduce || !bcBtn.animate) return;
    flying = true;
    var N = 16, dur = 3000, slices = document.createElement("span");
    slices.className = "bc-slices"; slices.setAttribute("aria-hidden", "true");
    for (var i = 0; i < N; i++) {
      var s = document.createElement("span"); s.className = "bc-slice";
      s.style.left = (i * 100 / N) + "%"; s.style.width = (100 / N + .15) + "%";
      var clone = bc.cloneNode(true); clone.removeAttribute("id");
      clone.style.left = (-i * 100) + "%"; clone.style.right = "auto"; clone.style.width = (N * 100) + "%";
      s.appendChild(clone); slices.appendChild(s);
      /* 조각마다 박자를 조금씩 늦춰 천이 펄럭이는 것처럼 */
      var wave = [], K = 36;
      for (var k = 0; k <= K; k++) {
        var t = k / K, amp = Math.sin(Math.PI * t) * 7;            // 뜰 때 커지고 내려앉으며 잦아듦
        wave.push({ transform: "translateY(" + (Math.sin(t * Math.PI * 9 - i * .55) * amp).toFixed(2) + "%)" });
      }
      s.animate(wave, { duration: dur, easing: "linear" });
    }
    bcBtn.appendChild(slices); bcBtn.classList.add("is-fly");

    /* 날아가는 길: 오른쪽 위로 떠서 멀리 돌아 왼쪽으로 돌아옵니다 */
    var W = bcBtn.getBoundingClientRect().width, vw = window.innerWidth;
    var A = Math.min(vw * .34, 380), B = Math.min(window.innerHeight * .34, 260);
    var path = [], shad = [], M = 48;
    for (var m = 0; m <= M; m++) {
      var u = m / M, e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;   // 천천히 출발·도착
      var ang = e * Math.PI * 2, lift = Math.sin(Math.PI * e);
      var x = Math.sin(ang) * A, y = -(1 - Math.cos(ang)) / 2 * B - lift * 24;
      var far = (1 - Math.cos(ang)) / 2;                                         // 0 가까움 → 1 멀리
      var sc = 1 - far * .42, bank = Math.cos(ang) * -16 * lift, pitch = lift * 56, yaw = Math.sin(ang) * -22;
      path.push({ transform: "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + sc.toFixed(3) + ") rotateX(" + pitch.toFixed(1) + "deg) rotateY(" + yaw.toFixed(1) + "deg) rotateZ(" + bank.toFixed(1) + "deg)" });
      shad.push({ transform: "translateX(" + x.toFixed(1) + "px) scale(" + (1 - far * .5).toFixed(3) + ")", opacity: (lift * .8).toFixed(2) });
    }
    shadow.animate(shad, { duration: dur, easing: "linear" });
    var fly = bcBtn.animate(path, { duration: dur, easing: "linear" });
    fly.onfinish = fly.oncancel = function () {
      bcBtn.classList.remove("is-fly"); slices.remove(); flying = false;
    };
  });

  /* ── 4. 상담 신청 → 대표 휴대폰 알림 (카카오 알림톡, 실패 시 문자) ──
     DNA LABS 상담알림 허브(구글 Apps Script)로 보냅니다. 받을 번호·발송방식은 허브 시트 '고객사' 탭의 dnalabs 줄에서 정합니다.
     덧붙여 /api/contact (AI 정리 + 텔레그램)에도 조용히 한 번 보냅니다 — 설정이 안 돼 있으면 그냥 넘어갑니다. */
  var form = $("#form"), msg = $("#formMsg"), sendBtn = $(".btn-send", form);
  var HUB_URL = form.getAttribute("data-endpoint"), HUB_ID = form.getAttribute("data-client"), openedAt = Date.now();
  function say(text, kind) { msg.textContent = text; msg.className = "form-msg " + (kind || ""); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = new FormData(form), bad = null;
    ["name", "phone", "want"].forEach(function (n) {
      var el = form.elements[n], empty = !String(d.get(n) || "").trim();
      el.closest(".f").classList.toggle("is-bad", empty);
      el.setAttribute("aria-invalid", String(empty));
      if (empty && !bad) bad = el;
    });
    if (bad) { say("이름, 연락처, 희망 상담 내용을 적어 주세요.", "bad"); bad.focus(); return; }
    if (!form.elements.agree.checked) { say("개인정보 수집·이용에 동의해 주세요.", "bad"); form.elements.agree.focus(); return; }
    var name = String(d.get("name")).trim(), phone = String(d.get("phone")).trim(), company = String(d.get("company") || "").trim();
    var want = String(d.get("want")), text = String(d.get("message") || "").trim(), hp = String(d.get("website") || "");
    var summary = [company && ("상호 " + company), "희망 상담 " + want, text].filter(Boolean).join(" / ").slice(0, 500);
    sendBtn.disabled = true; say("보내는 중입니다…");
    fetch(HUB_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ clientId: HUB_ID, name: name, phone: phone, message: summary, agree: true, website: hp, openedAt: openedAt, page: location.href }) })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.text(); })
      .then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (_) {} if (j && (j.ok === false || j.error)) throw new Error("hub"); })
      .then(function () {
        try { fetch("/api/contact", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name, contact: phone, company: company, want: want, message: text, website: hp, agreed: true }) }).catch(function () {}); } catch (_) {}
        form.reset(); openedAt = Date.now(); say("상담 신청이 접수됐습니다. 확인하는 대로 연락드리겠습니다.", "ok");
      })
      .catch(function () { say("지금은 전송되지 않았습니다. 010-4642-3477 또는 hello@dnalabs.kr 로 연락 주세요.", "bad"); })
      .then(function () { sendBtn.disabled = false; });
  });

  /* ── 5. AI 체험: 구성 추천 · 홈페이지 진단 (Claude API) ──
     서버 함수 /api/recommend, /api/diagnose 가 Claude 에게 묻고 결과만 돌려줍니다. API 열쇠는 서버에만 있습니다. */
  var LIVE = /(^|\.)dnalabs\.kr$/.test(location.hostname) || /\.vercel\.app$/.test(location.hostname);
  var aiTabs = $$("#ai .tab"), aiPanes = $$("#ai .ai-pane");
  function aiSelect(i, focus) {
    aiTabs.forEach(function (b, k) { var on = k === i; b.classList.toggle("is-on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; aiPanes[k].hidden = !on; });
    if (focus) aiTabs[i].focus();
  }
  aiTabs.forEach(function (b, i) {
    b.addEventListener("click", function () { aiSelect(i); });
    b.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); aiSelect((i + 1) % aiTabs.length, true); } });
  });
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function block(label, node) { var d = el("div"); d.appendChild(el("p", "ai-k", label)); d.appendChild(node); return d; }
  function badge(out, demo) { out.appendChild(el("span", "ai-badge" + (demo ? " demo" : ""), demo ? "예시 결과 · 시안에서는 AI가 연결되어 있지 않습니다" : "AI가 만든 초안 · 참고용")); }
  function loading(out, text) { out.hidden = false; out.textContent = ""; var l = el("p", "ai-load"); l.appendChild(el("i")); l.appendChild(document.createTextNode(text)); out.appendChild(l); }
  var ERR = { limit: "잠시 사용이 많습니다. 조금 뒤에 다시 시도해 주세요.", bad_url: "주소를 다시 확인해 주세요. (예: example.co.kr)", unreachable: "그 주소의 첫 화면을 읽지 못했습니다. 주소를 확인하거나 다른 주소로 시도해 주세요.", required: "필요한 칸을 채워 주세요." };
  function call(path, payload) {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) { var e = new Error(j.error || "fail"); e.status = r.status; throw e; } return j; }); });
  }
  function toContact(text) {
    var ta = form.elements.message; ta.value = text; document.getElementById("contact").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    setTimeout(function () { form.elements.name.focus({ preventScroll: true }); }, 600);
  }

  /* 구성 추천 */
  var recForm = $("#recForm"), recOut = $("#recOut"), recMsg = $("#recMsg");
  var REC_DEMO = { menus: ["소개", "수업 안내", "강사", "후기", "예약·오시는 길"], headline: "처음이어도 괜찮은, 동네 필라테스", sub: "소수 정원으로 내 몸 상태에 맞춰 천천히 시작합니다.", cta: "체험 수업 예약하기",
    sections: [{ name: "첫 화면", why: "어떤 곳인지와 예약 단추를 가장 먼저 보여 줍니다." }, { name: "수업 안내", why: "어떤 수업이 있는지 알아야 예약을 결정합니다." }, { name: "강사 소개", why: "누가 가르치는지가 믿음을 줍니다." }, { name: "회원 후기", why: "비슷한 사람의 경험이 망설임을 줄입니다." }, { name: "예약·오시는 길", why: "마음먹은 순간 바로 예약하고 찾아올 수 있어야 합니다." }],
    reason: "예약이 목적이라 모든 구역 끝에 예약 단추가 닿도록 짰습니다. 처음 오는 분의 걱정(내가 따라갈 수 있을까)을 먼저 풀어 주는 순서입니다." };
  function showRec(r, demo, input) {
    recOut.hidden = false; recOut.textContent = ""; badge(recOut, demo);
    var ul = el("ul", "ai-menus"); (r.menus || []).forEach(function (m) { ul.appendChild(el("li", "", m)); }); recOut.appendChild(block("MENU · 메뉴", ul));
    var hero = el("div", "ai-hero"); hero.appendChild(el("b", "", r.headline)); hero.appendChild(el("p", "", r.sub)); hero.appendChild(el("i", "", r.cta)); recOut.appendChild(block("FIRST VIEW · 첫 화면", hero));
    var ol = el("ol", "ai-list"); (r.sections || []).forEach(function (s) { var li = el("li"); li.appendChild(el("b", "", s.name)); li.appendChild(el("span", "", s.why)); ol.appendChild(li); }); recOut.appendChild(block("SECTIONS · 화면 순서", ol));
    recOut.appendChild(block("WHY · 이렇게 추천한 이유", el("p", "ai-p", r.reason)));
    var go = el("button", "btn", "이 구성으로 상담 요청하기"); go.type = "button";
    go.addEventListener("click", function () { toContact("[AI 구성 추천을 보고 문의]\n업종: " + input.industry + "\n목적: " + input.goal + "\n추천 메뉴: " + (r.menus || []).join(" / ") + (input.note ? "\n덧붙인 말: " + input.note : "")); });
    recOut.appendChild(go);
  }
  recForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = new FormData(recForm), input = { industry: String(d.get("industry") || "").trim(), goal: String(d.get("goal") || ""), note: String(d.get("note") || "").trim() };
    if (!input.industry || !input.goal) { recMsg.textContent = "업종과 목적을 알려 주세요."; recMsg.className = "form-msg bad"; (input.industry ? recForm.elements.goal : recForm.elements.industry).focus(); return; }
    recMsg.textContent = ""; var btn = $(".btn", recForm); btn.disabled = true; loading(recOut, "구성을 짜고 있습니다…");
    call("/api/recommend", input).then(function (j) { showRec(j.result, false, input); })
      .catch(function (err) {
        if (!LIVE) { showRec(REC_DEMO, true, input); return; }
        recOut.hidden = true; recMsg.textContent = ERR[err.message] || "지금은 추천을 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요."; recMsg.className = "form-msg bad";
      }).then(function () { btn.disabled = false; });
  });

  /* 홈페이지 진단 */
  var diagForm = $("#diagForm"), diagOut = $("#diagOut"), diagMsg = $("#diagMsg");
  var DIAG_DEMO = { summary: "동네 인테리어 시공 업체의 홈페이지로 보입니다.", good: "시공 사례가 메뉴에 따로 있어 실력을 확인하기 쉽습니다.",
    fixes: [{ title: "첫 화면에 무엇을 하는 곳인지 한 줄이 없습니다", why: "처음 온 손님은 몇 초 안에 업종을 알아야 머뭅니다.", how: "큰 제목에 지역과 하는 일을 함께 적습니다." }, { title: "누르면 전화가 걸리는 단추가 없습니다", why: "휴대폰으로 본 손님이 번호를 따로 눌러야 합니다.", how: "화면 위와 아래에 전화 단추를 둡니다." }, { title: "검색에 보일 소개 문구가 비어 있습니다", why: "검색 결과에 엉뚱한 글이 대신 나옵니다.", how: "한두 문장짜리 소개 문구를 넣습니다." }] };
  function showDiag(r, demo, url) {
    diagOut.hidden = false; diagOut.textContent = ""; badge(diagOut, demo);
    diagOut.appendChild(block("SUMMARY · 이렇게 보입니다", el("p", "ai-p", r.summary)));
    diagOut.appendChild(block("GOOD · 잘 된 점", el("p", "ai-p", r.good)));
    var ol = el("ol", "ai-list"); (r.fixes || []).forEach(function (f) { var li = el("li"); li.appendChild(el("b", "", f.title)); li.appendChild(el("span", "", f.why)); li.appendChild(el("em", "", "→ " + f.how)); ol.appendChild(li); });
    diagOut.appendChild(block("FIX · 고치면 좋은 3가지", ol));
    var go = el("button", "btn", "이 내용으로 상담 요청하기"); go.type = "button";
    go.addEventListener("click", function () { toContact("[AI 홈페이지 진단을 보고 문의]\n주소: " + url + "\n고칠 점: " + (r.fixes || []).map(function (f) { return f.title; }).join(" / ")); });
    diagOut.appendChild(go);
  }
  diagForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var url = String(new FormData(diagForm).get("url") || "").trim();
    if (!/^(https?:\/\/)?[^\s\/]+\.[^\s\/]{2,}/i.test(url)) { diagMsg.textContent = ERR.bad_url; diagMsg.className = "form-msg bad"; diagForm.elements.url.focus(); return; }
    diagMsg.textContent = ""; var btn = $(".btn", diagForm); btn.disabled = true; loading(diagOut, "첫 화면을 읽고 있습니다…");
    call("/api/diagnose", { url: url }).then(function (j) { showDiag(j.result, false, j.url || url); })
      .catch(function (err) {
        if (!LIVE) { showDiag(DIAG_DEMO, true, url); return; }
        diagOut.hidden = true; diagMsg.textContent = ERR[err.message] || "지금은 진단하지 못했습니다. 잠시 뒤 다시 시도해 주세요."; diagMsg.className = "form-msg bad";
      }).then(function () { btn.disabled = false; });
  });

  /* ── 6. 마우스에 반응하는 효과 ── */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hero = $("#top");
  if (hero && fine && !reduce) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      hero.style.setProperty("--gx", (x * 100).toFixed(1) + "%"); hero.style.setProperty("--gy", (y * 100).toFixed(1) + "%");   // 빛이 따라옵니다
      hero.classList.add("is-live");                                                                                                // 이름표가 튀어나옵니다
    });
    hero.addEventListener("pointerleave", function () {
      hero.classList.remove("is-live");
    });
  }
  /* 작업물·명함 위에서 마우스를 따라다니는 이름표 */
  var cur = $("#cur");
  if (cur && fine && !reduce) {
    var label = $("b", cur), cx = -100, cy = -100, tx = -100, ty = -100, raf = 0;
    function tickCur() { cx += (tx - cx) * .22; cy += (ty - cy) * .22; cur.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)"; raf = (Math.abs(tx - cx) + Math.abs(ty - cy) > .3) ? requestAnimationFrame(tickCur) : 0; }
    window.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY + 34; if (!raf) raf = requestAnimationFrame(tickCur); }, { passive: true });
    function bind(el, text) {
      el.addEventListener("pointerenter", function () { label.textContent = text; cur.classList.add("is-on"); });
      el.addEventListener("pointerleave", function () { cur.classList.remove("is-on"); });
      el.addEventListener("pointerdown", function () { cur.classList.remove("is-on"); });
    }
    $$("a.clay").forEach(function (a) { bind(a, "열어 보기 ↗"); });
    bind(bcBtn, "눌러 보세요");
  }

  /* ── 7. 큰 DNA LABS 줄 로고: 마우스가 지나가면 기타줄처럼 튕기고 잦아듭니다 ── */
  (function () {
    var box = $("#strings"), g = $("#strLines"); if (!box || !g) return;
    var W = 1200, H = 300, N = 30, NS = "http://www.w3.org/2000/svg", lines = [];
    for (var i = 0; i < N; i++) {
      var y = 6 + i * (H - 12) / (N - 1), el = document.createElementNS(NS, "path");
      el.setAttribute("d", "M0 " + y + " H" + W); g.appendChild(el);
      lines.push({ y: y, a: 0, v: 0, x: W / 2, el: el });
    }
    if (reduce) return;
    var raf = 0, last = null;
    function draw() {
      var busy = false;
      lines.forEach(function (l) {
        if (l.a === 0 && l.v === 0) return;
        l.v += (-l.a * .22) - l.v * .075;            // 당겨졌다 돌아가는 힘 + 서서히 잦아듦
        l.a += l.v;
        if (Math.abs(l.a) < .05 && Math.abs(l.v) < .05) { l.a = 0; l.v = 0; l.el.setAttribute("d", "M0 " + l.y + " H" + W); return; }
        busy = true;
        l.el.setAttribute("d", "M0 " + l.y + " Q" + l.x.toFixed(1) + " " + (l.y + l.a * 2).toFixed(2) + " " + W + " " + l.y);
      });
      raf = busy ? requestAnimationFrame(draw) : 0;
    }
    function pt(e) { var r = box.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
    box.addEventListener("pointermove", function (e) {
      var p = pt(e);
      if (last) {
        var dy = p.y - last.y, lo = Math.min(last.y, p.y), hi = Math.max(last.y, p.y);
        lines.forEach(function (l) {
          if (l.y >= lo && l.y <= hi) {               // 이 줄을 건너갔으면 튕김
            l.x = Math.max(60, Math.min(W - 60, p.x));
            l.v += Math.max(-14, Math.min(14, dy * .9)) || (dy >= 0 ? 4 : -4);
          }
        });
        if (!raf) raf = requestAnimationFrame(draw);
      }
      last = p;
    });
    box.addEventListener("pointerleave", function () { last = null; });
    box.addEventListener("pointerdown", function (e) { last = pt(e); });
    /* 화면에 처음 들어올 때 한 번 좌르르 울립니다 */
    if ("IntersectionObserver" in window) {
      var once = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return; once.disconnect();
        lines.forEach(function (l, i) { setTimeout(function () { l.x = W * (.2 + .6 * (i / N)); l.v += (i % 2 ? 7 : -7); if (!raf) raf = requestAnimationFrame(draw); }, i * 28); });
      }, { threshold: .5 });
      once.observe(box);
    }
  })();
})();
