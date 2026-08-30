/* 이 파일은 만들어진 것입니다. 직접 고치지 마세요.
   원본은 저장소 루트의 catalog.json 이고,
   sync-catalog.sh 를 돌리면 이 파일이 다시 만들어집니다. */

export const CATALOG = {
  "_": "Re:Call 요금제와 업종 판정의 단일 출처입니다. 홈페이지·가입 화면·서버 검증이 모두 이 파일 하나를 봅니다. 값을 고치면 sync-catalog.sh 를 돌려 서버 쪽 사본을 다시 만드세요.",
  "revision": "2026-08-30",
  "plans": {
    "_": "price 는 원(KRW) 월 단가입니다. seatMin/seatMax 는 포함(inclusive)입니다. cardDailyLimit 은 1인이 하루에 인식할 수 있는 명함 수, cardMonthlyLimit 은 회사 전체가 한 달에 인식할 수 있는 명함 수입니다. 둘 다 한국시간(KST) 자정과 매월 1일을 기준으로 셉니다. null 은 제한 없음입니다. 영업용 숫자가 아니라 사고 방지선입니다 — 요금표에 적지 마세요.",
    "personal": {
      "name": "Personal",
      "label": "개인",
      "price": 19000,
      "per": "seat",
      "seatMin": 1,
      "seatMax": 1,
      "trialDays": 30,
      "cardDailyLimit": 100,
      "cardMonthlyLimit": 200,
      "tagline": "혼자 쓰는 고객 관리",
      "blurb": "명함을 찍어 넣고, 만난 기록을 남기고, 다음에 할 일을 놓치지 않는 것까지. 한 사람이 쓰기에 부족하지 않은 전부입니다.",
      "features": [
        "고객카드 무제한",
        "명함 자동 인식",
        "활동 기록과 할 일",
        "주소록에 바로 저장 (안드로이드)",
        "공개 범위 설정"
      ]
    },
    "business5": {
      "name": "Business 5",
      "label": "5명까지",
      "price": 49000,
      "per": "company",
      "seatMin": 1,
      "seatMax": 5,
      "trialDays": 0,
      "cardDailyLimit": 75,
      "cardMonthlyLimit": 600,
      "tagline": "팀이 막 생겼을 때",
      "blurb": "담당자가 바뀌어도 고객 이력이 회사에 남습니다.",
      "features": [
        "Personal 의 모든 기능",
        "직원 계정 5명까지",
        "고객 공유와 담당자 지정",
        "팀 현황판",
        "관리자 계정 관리"
      ]
    },
    "business20": {
      "name": "Business 20",
      "label": "6~20명",
      "price": 99000,
      "per": "company",
      "seatMin": 6,
      "seatMax": 20,
      "trialDays": 0,
      "cardDailyLimit": 75,
      "cardMonthlyLimit": 1250,
      "tagline": "영업팀이 굴러가기 시작할 때",
      "blurb": "누가 어느 고객을 맡고 있는지, 이번 달에 무슨 일이 있었는지가 한 화면에 보입니다.",
      "features": [
        "Business 5 의 모든 기능",
        "직원 계정 20명까지",
        "기간별 팀 활동 집계"
      ]
    },
    "business49": {
      "name": "Business 49",
      "label": "21~49명",
      "price": 249000,
      "per": "company",
      "seatMin": 21,
      "seatMax": 49,
      "trialDays": 0,
      "cardDailyLimit": 100,
      "cardMonthlyLimit": 3000,
      "tagline": "부서가 나뉘어 있을 때",
      "blurb": "부서별로 고객이 섞이지 않게 공개 범위를 나눠 씁니다.",
      "features": [
        "Business 20 의 모든 기능",
        "직원 계정 49명까지",
        "우선 기술지원"
      ]
    },
    "enterprise": {
      "name": "Enterprise",
      "label": "50명 이상",
      "price": null,
      "per": "quote",
      "seatMin": 50,
      "seatMax": null,
      "trialDays": 0,
      "cardDailyLimit": 150,
      "cardMonthlyLimit": null,
      "tagline": "별도 협의",
      "blurb": "인원과 요구사항을 듣고 맞춰 드립니다. 도입 검토 단계부터 함께 봅니다.",
      "features": [
        "Business 49 의 모든 기능",
        "직원 계정 제한 없음",
        "도입 지원과 사용 교육",
        "위탁 계약서 검토"
      ]
    }
  },
  "industries": {
    "_": "grade A=바로 가능 · B=확인 후 가능 · C=가입 불가. 근거는 「Re:Call 도입 판정 기준」(2026-08-28) 입니다.",
    "A": [
      {
        "id": "mfg",
        "name": "제조 · 부품 · 소재 · 화학",
        "why": "구매·자재 담당자 관리. 담당자 교체가 잦아 이력 관리 수요가 큽니다."
      },
      {
        "id": "trade",
        "name": "도매 · 유통 · 무역상사",
        "why": "거래처와 바이어 담당자 관리. 전시회에서 받은 명함이 그대로 자산이 됩니다."
      },
      {
        "id": "construct",
        "name": "건설 · 인테리어 · 설비",
        "why": "발주처·협력업체 담당자와 현장별 연락망. 현장에서 명함을 찍어 바로 등록하는 흐름이 잘 맞습니다."
      },
      {
        "id": "b2b",
        "name": "광고 · 디자인 · IT · 컨설팅",
        "why": "클라이언트 담당자와 협업 이력 관리. 담당자별 요청 기록이 그대로 근거가 됩니다."
      },
      {
        "id": "logistics",
        "name": "물류 · 운송 · 창고",
        "why": "화주와 협력사 담당자 관리."
      },
      {
        "id": "food",
        "name": "식자재 · 급식 · 외식 납품",
        "why": "거래 식당·급식소의 발주 담당자 관리."
      },
      {
        "id": "mice",
        "name": "전시 · 행사 · MICE",
        "why": "부스에서 받은 명함을 현장에서 바로 정리. 명함 인식이 가장 크게 쓰이는 유형입니다."
      },
      {
        "id": "franchise",
        "name": "프랜차이즈 본사 · 대리점 영업",
        "why": "가맹 상담과 대리점 담당자 관리."
      }
    ],
    "B": [
      {
        "id": "edu",
        "name": "학원 · 교육",
        "why": "성인 대상이면 문제없습니다.",
        "condition": "수강생이 만 14세 미만이면 법정대리인 동의를 따로 받으셔야 합니다.",
        "law": "개인정보 보호법 제22조의2"
      },
      {
        "id": "realty",
        "name": "부동산 중개",
        "why": "고객 연락처와 매물 문의 관리는 됩니다.",
        "condition": "거래 금액·자금 출처·계약 상세는 넣지 않는 조건입니다.",
        "law": null
      },
      {
        "id": "hr",
        "name": "인력 파견 · 헤드헌팅 · 채용대행",
        "why": "연락처 관리 용도로는 가능합니다.",
        "condition": "이력서·주민등록번호·건강 정보는 넣지 않는 조건입니다.",
        "law": null
      },
      {
        "id": "insure",
        "name": "보험대리점(GA) · 설계사",
        "why": "순수 인맥과 상담 일정 관리로 한정하면 가능합니다.",
        "condition": "계약 정보와 보험료를 넣으면 신용정보법 적용을 받습니다. 소속 보험사 규정도 함께 확인하세요.",
        "law": "신용정보의 이용 및 보호에 관한 법률"
      },
      {
        "id": "travel",
        "name": "여행사 · 항공 발권",
        "why": "고객 연락처 관리는 가능합니다.",
        "condition": "여권번호는 고유식별정보라 별도 동의와 암호화 의무가 붙습니다. 넣지 않는 조건입니다.",
        "law": "개인정보 보호법 제24조"
      },
      {
        "id": "auto",
        "name": "자동차 · 중장비 판매 · 정비",
        "why": "법인 영업이면 제한이 없습니다.",
        "condition": "개인 소비자 대상이면 할부·금융 정보를 넣지 않는 조건입니다.",
        "law": null
      }
    ],
    "C": [
      {
        "id": "finance",
        "name": "은행 · 증권 · 보험사 · 카드 · 저축은행 · 캐피탈",
        "why": "금융거래 정보를 외부 서버에 입력하는 것은 누설에 해당합니다. 5년 이하 징역 또는 5천만원 이하 벌금입니다. 업무망이 인터넷과 분리돼 접속조차 안 되는 경우가 대부분입니다.",
        "law": "금융실명법 제4조 · 제6조 / 신용정보법 / 전자금융감독규정 망분리"
      },
      {
        "id": "medical",
        "name": "병원 · 의원 · 치과 · 한의원 · 약국",
        "why": "환자 정보는 의료법이 누설을 금지합니다. 3년 이하 징역 또는 3천만원 이하 벌금이고, 형법상 업무상비밀누설죄도 함께 걸립니다.",
        "law": "의료법 제19조 · 제88조 / 형법 제317조 / 개인정보 보호법 제23조"
      },
      {
        "id": "legal",
        "name": "변호사 · 법무사 · 세무사 · 노무사",
        "why": "의뢰인 사건 정보는 직무상 비밀유지의무 대상입니다. 사건과 무관한 인맥 관리만이라면 이야기가 달라지지만, 실무에서 구분이 어려워 권하지 않습니다.",
        "law": "변호사법 제26조 등 각 직역법 비밀유지의무"
      },
      {
        "id": "psych",
        "name": "심리상담 · 정신건강 · 복지시설",
        "why": "상담 내용과 건강·장애 정보는 민감정보입니다. 별도 동의와 강화된 안전조치가 필요하고, 유출 시 피해 회복이 사실상 불가능합니다.",
        "law": "개인정보 보호법 제23조"
      },
      {
        "id": "credit",
        "name": "신용정보업 · 채권추심 · 대부업",
        "why": "개인신용정보 처리 자체가 허가·등록 사업이며 별도 규제를 받습니다.",
        "law": "신용정보의 이용 및 보호에 관한 법률"
      },
      {
        "id": "public",
        "name": "공공기관 · 지자체 · 공기업",
        "why": "위법은 아닙니다. 다만 조달 절차와 보안 요구사항(ISMS-P 인증, 망분리, 국내 감리)을 통과해야 하는데 아직 준비가 되지 않았습니다. 준비되면 다시 모시겠습니다.",
        "law": null
      }
    ],
    "principle": "가르는 기준은 업종 이름이 아니라 거기 담기는 정보입니다. 회사 담당자의 업무용 연락처를 관리하면 안전합니다. 법이 외부 반출을 금지한 정보 — 금융거래, 진료, 의뢰인 사건 — 를 담는 순간 제품의 품질과 무관하게 위법이 됩니다.",
    "refusalNote": "무료로 드려도 마찬가지입니다. 돈을 받지 않아도 저희가 개인정보 처리 수탁자가 되고, 사고가 나면 위험이 회사가 아니라 담당자 개인에게 갑니다. 그래서 가입을 막습니다."
  }
} as const;

/* 인원 수에 맞는 요금제. 화면(web/catalog.js)의 planForSeats 와
   같은 규칙이어야 합니다. personal 은 1인 전용이라 제외합니다. */
export function planForSeats(seats: number) {
  if (!Number.isInteger(seats) || seats < 1) return null;
  for (const [key, p] of Object.entries(CATALOG.plans)) {
    if (key === '_' || key === 'personal') continue;
    const q = p as any;
    if (seats >= q.seatMin && (q.seatMax === null || seats <= q.seatMax)) {
      return { key, ...q };
    }
  }
  return null;
}

/* 표시 순서대로. '_' 설명 항목은 걸러냅니다.
   web/catalog.js 의 planList 와 같은 규칙입니다. */
export function planList() {
  return Object.entries(CATALOG.plans)
    .filter(([k]) => k !== '_')
    .map(([key, p]) => ({ key, ...(p as any) }));
}

export function plan(key: string) {
  if (key === '_') return null;
  const p = (CATALOG.plans as any)[key];
  return p ? { key, ...p } : null;
}

export function seatsFit(p: any, seats: number) {
  if (!p || !Number.isInteger(seats)) return false;
  return seats >= p.seatMin && (p.seatMax === null || seats <= p.seatMax);
}

/* 업종 등급. C 는 가입을 막습니다. */
export function gradeOf(id: string): 'A' | 'B' | 'C' | null {
  for (const g of ['A', 'B', 'C'] as const) {
    if ((CATALOG.industries as any)[g].some((i: any) => i.id === id)) return g;
  }
  return null;
}
