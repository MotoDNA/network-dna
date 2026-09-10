/* ═══════════════════════════════════════════════════════════
   결제대행사(PG) 연결 지점

   지금은 계약 전이라 스텁입니다. 계약이 끝나면 이 파일 하나만
   바꾸면 되도록, 가입 화면은 아래 두 함수만 부릅니다.

     requestBillingKey(...)  카드 등록 → 빌링키 받기
     authorizeZero(key)      0원 승인으로 카드가 살아 있는지 확인

   ─────────────────────────────────────────────────────────
   ⚠ 절대로 지키셔야 할 것

   카드번호·유효기간·CVC 를 이 코드가 받아서는 안 됩니다.
   반드시 PG 가 띄우는 결제창에서 고객이 직접 입력하고,
   우리는 빌링키만 돌려받습니다.

   카드번호를 우리 화면에서 받는 순간 PCI-DSS 대상이 되고,
   그건 이 규모에서 감당할 수 있는 일이 아닙니다.
   화면에 카드번호 입력칸을 만들지 마세요.
   ─────────────────────────────────────────────────────────

   실제로 붙일 때 (토스페이먼츠 예)

     1. <script src="https://js.tosspayments.com/v2/standard"></script> 를 넣고
     2. requestBillingKey 를 아래처럼 바꿉니다

          const tp = TossPayments(CLIENT_KEY);
          const payment = tp.payment({ customerKey });
          const r = await payment.requestBillingAuth({
            method: 'CARD',
            successUrl: location.origin + '/signup-return.html',
            failUrl:    location.origin + '/signup-return.html?fail=1',
            customerEmail: opt.email,
            customerName:  opt.customerName
          });
          → 화면이 토스로 넘어갔다가 successUrl?authKey=…&customerKey=… 로 돌아옵니다.
            빌링키는 여기서 안 옵니다. 서버가 authKey 로 발급받습니다.

     3. 발급·결제는 브라우저에서 하지 않습니다.
        시크릿 키가 필요하므로 Edge Function 쪽에서 부릅니다.
        (signup 의 pgIssueBillingKey · subscription 의 pgChargeOnce)

   isStub 이 true 인 동안에는 가입 화면 맨 위에 "테스트 모드" 띠가 뜹니다.
   실제 PG 를 붙이면 그 띠가 저절로 사라집니다.
   ═══════════════════════════════════════════════════════════ */

const PG = (() => {

  // 'stub' | 'toss' | 'portone'
  //
  // 네이버페이를 나중에 붙일 생각이면 portone 이 낫습니다.
  // 네이버페이 결제형은 (1) 일반 PG 가 이미 연동돼 있어야 하고
  // (2) 최소 1개월 매출이 있어야 신청됩니다. PG 를 대신하는 것이 아니라
  // 그 위에 얹는 결제수단이라, 어차피 일반 PG 를 먼저 붙여야 합니다.
  const PROVIDER = 'stub';

  /* ── 스텁 ───────────────────────────────────────────────
     실제 결제창이 뜨는 것처럼 잠깐 기다렸다가 가짜 빌링키를 돌려줍니다.
     카드 정보를 묻지 않는 것이 핵심입니다 — 실제 PG 도 마찬가지로
     우리 코드가 카드번호를 보지 않습니다. */
  const stub = {
    async requestBillingKey(opt){
      await wait(900);
      return {
        billingKey: 'stub_' + rand(24),
        cardBrand : '테스트카드',
        last4     : '0000',
        customerKey: 'cust_' + rand(12)
      };
    },
    async authorizeZero(billingKey){
      await wait(700);
      if (!billingKey || !billingKey.startsWith('stub_')) {
        return { ok:false, message:'빌링키가 올바르지 않습니다.' };
      }
      return { ok:true, amount:0, approvedAt:new Date().toISOString() };
    }
  };

  /* ── 토스페이먼츠 ──────────────────────────────────────
     클라이언트 키는 브라우저에 두는 것이 맞습니다(test_ck_ / live_ck_).
     시크릿 키(test_sk_ / live_sk_)는 절대 여기 두지 않습니다 — 서버 환경변수에만.

     ⚠ 토스는 빌링키를 그 자리에서 돌려주지 않습니다.
       requestBillingAuth 를 부르면 화면이 토스 카드 입력창으로 **넘어갔다가**,
       successUrl 로 authKey · customerKey 를 들고 돌아옵니다. 그래서
         · 이 함수는 끝까지 돌아오지 않습니다(화면이 바뀝니다)
         · 부르기 전에 적어 둔 답을 sessionStorage 에 보관해야 합니다(signup.html)
         · 진짜 빌링키는 서버가 authKey 로 발급받습니다(signup 함수)
       0원 승인은 토스에 없습니다. 발급 자체가 카드 확인입니다. */
  const TOSS_CLIENT_KEY = '';          // 승인 나면 test_ck_… 로 시험, live_ck_… 로 운영

  function loadToss(){
    if (window.TossPayments) return Promise.resolve();
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://js.tosspayments.com/v2/standard';
      s.onload = ok;
      s.onerror = () => no(new Error('결제창을 불러오지 못했습니다. 잠시 뒤 다시 해 주세요.'));
      document.head.appendChild(s);
    });
  }

  const toss = {
    async requestBillingKey(opt){
      if (!TOSS_CLIENT_KEY) throw new Error('결제 설정이 아직 끝나지 않았습니다.');
      await loadToss();
      // customerKey: 영문·숫자·-_=.@ 로 2~50자. 우리 쪽 식별자이고 토스가 돌려줍니다.
      const customerKey = opt.customerKey || ('c_' + rand(24));
      const payment = window.TossPayments(TOSS_CLIENT_KEY).payment({ customerKey });
      const back = location.origin + location.pathname.replace(/\.html$/, '');
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: back + '?pg=ok',
        failUrl:    back + '?pg=fail',
        customerEmail: opt.email,
        customerName:  opt.customerName
      });
      // 여기까지 오면 화면이 이미 넘어간 뒤입니다. 돌아오지 않습니다.
      return new Promise(() => {});
    },
    // 토스는 0원 승인이 없습니다. 발급이 곧 확인이라 화면에서는 할 일이 없습니다.
    async authorizeZero(){ return { ok: true, skipped: true } }
  };

  /* ── 포트원 (계약 후 채웁니다) ── */
  const portone = {
    async requestBillingKey(){ throw new Error('포트원 연결이 아직 설정되지 않았습니다.') },
    async authorizeZero(){     throw new Error('포트원 연결이 아직 설정되지 않았습니다.') }
  };

  const impl = { stub, toss, portone }[PROVIDER];

  function wait(ms){ return new Promise(r => setTimeout(r, ms)) }
  function rand(n){
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return [...a].map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  }

  return {
    provider: PROVIDER,
    isStub: PROVIDER === 'stub',
    redirects: PROVIDER === 'toss',     // 카드 등록이 다른 쪽으로 넘어갔다 돌아오는가
    requestBillingKey: opt => impl.requestBillingKey(opt),
    authorizeZero:     key => impl.authorizeZero(key)
  };
})();
