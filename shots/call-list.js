/* Re:Call 고객 목록. 예시 자료입니다 — 목록에는 연락처가 안 나옵니다. */
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
hideGate(); paintOwner(); render(); paintUsage(); go('list'); window.scrollTo(0,0);
