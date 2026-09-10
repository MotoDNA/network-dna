/* Re:Call 고객카드와 만난 기록. 연락처는 우리 것입니다 — 남의 번호를 예시로 박아 두면 그 사람에게 전화가 갑니다. */
window.sbInit=function(){return true};
sb={channel:function(){return{on:function(){return this},subscribe:function(){}}},
    removeAllChannels:function(){}};
me={id:'u1',name:'최환준',loginId:'admin',role:'admin',companyId:'c1',
    companyCode:'BKT',companyName:'디엔에이랩스',apps:['recall']};
/* 담당자·공유는 이름이 아니라 계정 id 로 잡습니다 — 이름으로 넣으면 동그라미가 '?' 로 뜹니다 */
cfg.members=[{id:'u1',name:'최환준'},{id:'u2',name:'김서연'},{id:'u3',name:'박도현'}];
cfg.groups=['신규','진행 중','주요 고객','대리점'];

/* 앱은 'YYYY-MM-DDTHH:mm' 지역시각으로 씁니다. toISOString() 을 쓰면
   UTC 로 아홉 시간 당겨져 오후 2시가 05:30 으로 찍힙니다. */
var 날=function(n,h,m){var d=new Date(2026,7,29); d.setDate(d.getDate()-n);
  var p=function(x){return String(x).padStart(2,'0')};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(h)+':'+p(m)};
var C=function(o){return Object.assign({groups:[],owner:'u1',shared:[],photo:null,
  updated:1,dirty:false,deleted:false},o)};
var A=function(o){return Object.assign({due:'',done:false,by:'u1',
  updated:1,dirty:false,deleted:false},o)};

custs=[
 C({uid:'c1',company:'대성지업',name:'정우철',title:'구매부장',groups:['주요 고객'],
    createdAt:날(120,10,0),lastAt:날(1,14,30),shared:['u2']}),
 C({uid:'c2',company:'한빛소재',name:'김서연',title:'구매팀장',groups:['주요 고객','진행 중'],
    createdAt:날(90,10,0),lastAt:날(3,11,0)}),
 C({uid:'c3',company:'우진패키징',name:'박도현',title:'대표이사',groups:['대리점'],
    createdAt:날(60,10,0),lastAt:날(6,16,20),shared:['u3','u2']}),
 C({uid:'c4',company:'세림텍스',name:'이민정',title:'디자인실장',groups:['진행 중'],
    createdAt:날(40,10,0),lastAt:날(9,10,10)}),
 C({uid:'c5',company:'동아상사',name:'최성훈',title:'영업이사',groups:['신규'],
    createdAt:날(12,10,0),lastAt:날(12,15,0)}),
];
acts=[
 A({uid:'a1',cid:'c1',kind:'meeting',at:날(1,14,30),
    body:'연간 물량 계획 공유. 상반기 2000연, 하반기 3000연 예상한다고 함.'}),
 A({uid:'a2',cid:'c1',kind:'todo',at:날(1,14,40),due:'2026-09-02',
    body:'견적서 재발행해서 메일로 보내기'}),
 A({uid:'a7',cid:'c1',kind:'request',at:날(9,10,20),
    body:'PATRIX 흑색 500연 추가 요청. 9월 첫째 주 입고 희망.'}),
 A({uid:'a8',cid:'c1',kind:'meeting',at:날(23,15,0),
    body:'파주 공장 방문. 신규 라인 증설로 10월부터 물량 늘 것으로 봄.'}),
 A({uid:'a9',cid:'c1',kind:'note',at:날(38,9,30),
    body:'구매 결재선이 바뀜. 5백만원 넘으면 본부장 결재 필요.'}),
 A({uid:'a3',cid:'c2',kind:'request',at:날(3,11,0),
    body:'MUSE 2 샘플 5종 요청. 다음 주 화요일까지 도착 희망.'}),
 A({uid:'a4',cid:'c3',kind:'issue',at:날(6,16,20),
    body:'지난 납품분 폭 1100mm 편차 문의. 생산팀 확인 중.'}),
 A({uid:'a5',cid:'c4',kind:'note',at:날(9,10,10),
    body:'디자인실 인원 충원 예정. 하반기부터 물량 늘 것으로 봄.'}),
 A({uid:'a6',cid:'c5',kind:'meeting',at:날(12,15,0),
    body:'첫 미팅. 취급 품목과 단가표 전달함.'}),
];
custs.forEach(function(c){(c.groups||[]).forEach(ensureGroup)});
hideGate(); paintOwner(); render(); paintUsage(); go("list");
custs[0].phone="010-6451-5807"; custs[0].email="hello@dnalabs.kr";
custs[0].addr="경기도 파주시 문발로 140, 301-D57호";
openDetail("c1");
/* 타임라인이 이 앱의 핵심이라 첫 화면에 그것이 오도록 내려 둡니다.
   높이를 숫자로 못 박으면 화면이 바뀔 때마다 어긋나니, "타임라인" 제목을 찾아 그 앞까지 내립니다. */
var 제목=[].slice.call(document.querySelectorAll('#detail .sec'))
  .filter(function(e){return /타임라인/.test(e.textContent)})[0];
if(제목){
  var 판=document.getElementById('detail');
  /* 위쪽 막대가 붙박이로 덮으니 그만큼 더 남겨 둡니다 */
  판.scrollTop += 제목.getBoundingClientRect().top - 판.getBoundingClientRect().top - 74;
}
