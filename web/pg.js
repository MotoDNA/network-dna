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
          return { billingKey: r.billingKey, ... };

     3. authorizeZero 는 브라우저에서 하지 않습니다.
        시크릿 키가 필요하므로 Edge Function 쪽에서 부릅니다.
        (supabase/functions/signup/index.ts 의 pgAuthorizeZero 참고)

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

  /* ── 토스페이먼츠 (계약 후 채웁니다) ── */
  const toss = {
    async requestBillingKey(){ throw new Error('토스페이먼츠 연결이 아직 설정되지 않았습니다.') },
    async authorizeZero(){     throw new Error('토스페이먼츠 연결이 아직 설정되지 않았습니다.') }
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
    requestBillingKey: opt => impl.requestBillingKey(opt),
    authorizeZero:     key => impl.authorizeZero(key)
  };
})();
