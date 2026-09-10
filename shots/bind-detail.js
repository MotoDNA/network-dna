/* 예시 자료. 연락처는 우리 것을 씁니다 — 남의 번호를 박아 두면 그 사람에게 전화가 갑니다. */
window.sbInit=function(){return true};
sb={from:function(){return{select:function(){return{eq:function(){return{maybeSingle:async function(){return{data:null}}}}}}}},
    channel:function(){return{on:function(){return this},subscribe:function(){}}},removeAllChannels:function(){}};
me={id:'u1',name:'최환준',loginId:'admin',role:'admin',companyId:'c1',
    companyCode:'BKT',companyName:'비케이티',apps:['rebind']};
members=[me];
issuer={biz_no:'119-37-01707',ceo:'최환준',tel:'010-6451-5807',
        addr:'경기도 파주시 문발로 140, 301-D57호',biz_type:'제조업',biz_item:'인쇄 · 제본',
        bank:'국민은행 000-00-0000 디엔에이랩스',vat_rate:10,staff_money:false,staff_settle:false,staff_memo:false,preset:{}};
var P=function(o){return Object.assign({kind:'project',owner:'u1',shared:[],code:'',person:'',phone:'010-6451-5807',
  email:'hello@dnalabs.kr',unit:'부',size:'',pages:null,color:'',paper:'',paperCover:'',paperInner:'',bind:'',finish:'',
  options:[],price:0,vat:10,extras:[],costs:[],startedOn:'2026-08-10',dueOn:'2026-09-05',doneOn:null,
  billedOn:null,taxedOn:null,paidOn:null,photos:[],orderPhoto:null,memo:'',arrivals:[],token:null,shareOn:false,
  hiddenOn:null,createdAt:'2026-08-10',updatedAt:'2026-08-28'},o)};
prjs=[
 P({id:'p1',name:'2027 하드커버 다이어리',client:'블루밍문구',person:'김민수 과장',code:'BL-2708',
    qty:3000,size:'국배판 148×210',pages:208,color:'표지 4도 / 내지 1도',
    paperCover:'스노우지 250g',paperInner:'모조지 80g',bind:'양장',finish:'무광코팅 · 박',
    status:'running',dueOn:'2026-09-05',price:4800,
    arrivals:[{n:'표지 용지',s:'스노우지 250g',on:'2026-08-18'},{n:'내지 용지',s:'모조지 80g',on:'2026-08-20'}],
    shareOn:true,token:'x'}),
 P({id:'p2',name:'회사소개 브로슈어',client:'액티바코리아',person:'박지은 대리',code:'AC-0812',
    qty:1000,size:'A4',pages:24,color:'양면 4도',paperCover:'아트지 200g',paperInner:'아트지 150g',
    bind:'중철',finish:'무광코팅',status:'running',dueOn:'2026-09-01',price:2200,
    arrivals:[{n:'표지 용지',s:'아트지 200g',on:'2026-08-25'},{n:'내지 용지',s:'',on:null}]}),
 P({id:'p3',name:'제품 카탈로그 2026',client:'대한제본',person:'이준호 팀장',code:'DH-0730',
    qty:500,size:'국배판',pages:64,color:'양면 4도',paperCover:'스노우지 200g',paperInner:'스노우지 120g',
    bind:'무선',finish:'유광코팅',status:'done',dueOn:'2026-08-22',doneOn:'2026-08-21',price:3500,
    billedOn:'2026-08-22'}),
 P({id:'p4',name:'단어장 (스프링)',client:'한솔제지',person:'정현우 과장',code:'HS-0805',
    qty:2000,size:'A6',pages:128,color:'1도',paperCover:'아르떼 210g',paperInner:'모조지 70g',
    bind:'트윈링',finish:'귀도리',status:'ready',dueOn:'2026-09-12',price:1600}),
];
allSteps=[
 {id:'s1',projectId:'p1',name:'파일 입고 · 검수',percent:10,at:'2026-08-12',note:'',by:'u1',photoPath:null,createdAt:'2026-08-12'},
 {id:'s2',projectId:'p1',name:'인쇄',percent:35,at:'2026-08-19',note:'표지 4도 완료',by:'u1',photoPath:null,createdAt:'2026-08-19'},
 {id:'s3',projectId:'p1',name:'접지',percent:55,at:'2026-08-24',note:'',by:'u1',photoPath:null,createdAt:'2026-08-24'},
 {id:'s4',projectId:'p1',name:'정합',percent:70,at:'2026-08-27',note:'208면 확인',by:'u1',photoPath:null,createdAt:'2026-08-27'},
 {id:'s5',projectId:'p2',name:'인쇄',percent:40,at:'2026-08-26',note:'',by:'u1',photoPath:null,createdAt:'2026-08-26'},
 {id:'s6',projectId:'p3',name:'출고 · 납품',percent:100,at:'2026-08-21',note:'500부 전량',by:'u1',photoPath:null,createdAt:'2026-08-21'},
];
hideGate(); document.getElementById('app').hidden=false;
paintMe(); paintPerms(); clearNew(); renderChips(); renderList(); renderQuotes(); paintIssuer(); paintTradeLabels();
go('list'); openDetail('p1');
/* 이 앱의 핵심은 공정 기록입니다. 첫 화면에 그것이 오도록 내려 둡니다.
   높이를 숫자로 못 박으면 화면이 바뀔 때마다 어긋나니 "공정" 제목을 찾습니다.
   위쪽 막대가 붙박이로 덮으니 그만큼 더 남겨 둡니다. */
var 판=document.getElementById('detail');
var 제목=[].slice.call(판.querySelectorAll('h3'))
  .filter(function(e){return e.textContent.indexOf('공정')===0})[0];
if(제목) 판.scrollTop += 제목.getBoundingClientRect().top - 판.getBoundingClientRect().top - 88;
