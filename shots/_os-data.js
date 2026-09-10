/* 예시 자료. 연락처는 우리 것을 씁니다 — 남의 번호를 박아 두면 그 사람에게 전화가 갑니다.
   날짜는 찍는 날 기준으로 셉니다 — 날짜를 박아 두면 몇 달 뒤 다시 찍을 때 전부 "지연" 이 됩니다. */
window.sbInit=function(){return true};
/* 앱의 boot() 가 진짜 서버에 물어보고 나서 뒤늦게 로그인 화면을 다시 띄웁니다(400ms 뒤에 우리가 도는데 그보다 늦게 옵니다).
   그래서 문지기를 아예 벙어리로 만듭니다. */
window.showGate=function(){}; window.sayBounced=function(){};
sb={from:function(){return{select:function(){return{eq:function(){return{maybeSingle:async function(){return{data:null}}}}}}}},
    channel:function(){return{on:function(){return this},subscribe:function(){}}},removeAllChannels:function(){},
    auth:{getUser:async function(){return{data:{user:null}}},signOut:async function(){}}};
var T0=new Date(Date.now()+9*3600e3); function d(n){return new Date(T0.getTime()+n*86400e3).toISOString().slice(0,10)}
function h(n){return new Date(Date.now()-n*3600e3).toISOString()}
me={id:'u1',name:'최환준',loginId:'admin',role:'admin',companyId:'c0',companyCode:'DNALABS',companyName:'디엔에이랩스',apps:['reos']};
D=blankData();
D.members=[me,{id:'u2',login_id:'seoyeon',name:'김서연',role:'user'}];
D.customers=[{id:'c1',name:'블루밍문구',contacts:[]},{id:'c2',name:'액티바코리아',contacts:[]},{id:'c3',name:'그린라이프',contacts:[]}];
D.suppliers=[{id:'s1',name:'한솔인쇄',caps:['옵셋','무선제본']},{id:'s2',name:'대한제본',caps:['양장','PUR']},{id:'s3',name:'우진패키지',caps:['단상자','톰슨']}];
var P=function(o){return Object.assign({company_id:'c0',owner_id:'u1',shared_ids:[],code:'',contact_name:'',category:'note',
  status:'inquiry',priority:'normal',started_on:d(-20),due_on:d(20),delivered_on:null,qty_plan:null,qty_final:null,tags:[],
  memo:'',hold_reason:'',share_token:null,share_on:false,created_at:d(-20),updated_at:d(-1),deleted:false},o)};
D.projects=[
 P({id:'p1',code:'PRJ-2026-0041',name:'2027 데스크 다이어리',customer_id:'c1',contact_name:'김민수 과장',category:'diary',status:'ordered',priority:'high',due_on:d(18),qty_plan:5000,qty_final:5000,started_on:d(-24),share_on:true}),
 P({id:'p2',code:'PRJ-2026-0043',name:'브랜드 노트 3종 세트',customer_id:'c2',contact_name:'박지은 대리',category:'note',status:'sample',due_on:d(25),qty_plan:3000}),
 P({id:'p3',code:'PRJ-2026-0044',name:'선물용 단상자 패키지',customer_id:'c3',contact_name:'이준호 팀장',category:'package',status:'review',due_on:d(9),qty_plan:2000,owner_id:'u2'}),
 P({id:'p4',code:'PRJ-2026-0038',name:'스케치북 A4 (스프링)',customer_id:'c1',category:'sketchbook',status:'production',due_on:d(5),qty_final:1500}),
 P({id:'p5',code:'PRJ-2026-0046',name:'전시회 리플릿',customer_id:'c2',category:'print',status:'quotation',due_on:d(30),qty_plan:10000,owner_id:'u2'}),
 P({id:'p6',code:'PRJ-2026-0031',name:'2026 탁상 캘린더',customer_id:'c3',category:'goods',status:'done',due_on:d(-12),delivered_on:d(-13),qty_final:4000}),
];
D.money={p1:{project_id:'p1',sales_amount:9800000},p2:{project_id:'p2',sales_amount:5400000},p3:{project_id:'p3',sales_amount:4200000},
         p4:{project_id:'p4',sales_amount:2700000},p6:{project_id:'p6',sales_amount:6000000}};
D.costs=[
 {id:'k1',project_id:'p1',cat:'outsource',name:'외주 제작비',est_amount:6000000,fix_amount:6200000,act_amount:null,sort:1},
 {id:'k2',project_id:'p1',cat:'sample',name:'샘플 제작비',est_amount:150000,fix_amount:150000,act_amount:150000,sort:2},
 {id:'k3',project_id:'p2',cat:'outsource',name:'외주 제작비',est_amount:3300000,fix_amount:null,act_amount:null,sort:1},
 {id:'k4',project_id:'p3',cat:'outsource',name:'외주 제작비',est_amount:2600000,fix_amount:2600000,act_amount:null,sort:1},
 {id:'k5',project_id:'p4',cat:'outsource',name:'외주 제작비',est_amount:1500000,fix_amount:1500000,act_amount:1560000,sort:1},
 {id:'k6',project_id:'p6',cat:'outsource',name:'외주 제작비',est_amount:3600000,fix_amount:3600000,act_amount:3600000,sort:1},
];
D.tasks=[
 {id:'t1',project_id:'p3',title:'고객 승인 회신 확인 전화',due_on:d(0),done:false,assignee_id:'u1'},
 {id:'t2',project_id:'p1',title:'표지 컬러 샘플 수령',due_on:d(2),done:false,assignee_id:'u1'},
 {id:'t3',project_id:'p5',title:'견적서 2안 보내기',due_on:d(3),done:false,assignee_id:'u2'},
];
D.acts=[
 {id:'a1',project_id:'p1',kind:'po',body:'한솔인쇄에 발주서를 보냈습니다',by_name:'최환준',at:h(2)},
 {id:'a2',project_id:'p3',kind:'approval',body:'고객 승인을 요청했습니다',by_name:'김서연',at:h(26)},
 {id:'a3',project_id:'p2',kind:'sample',body:'1차 샘플을 등록했습니다',by_name:'최환준',at:h(50)},
 {id:'a4',project_id:'p4',kind:'status',body:'생산 단계로 넘겼습니다',by_name:'최환준',at:h(72)},
 {id:'a5',project_id:'p1',kind:'rfq',body:'견적을 확정했습니다 — 한솔인쇄',by_name:'최환준',at:h(80)},
];
D.settings={company_id:'c0',staff_money:false}; staffMoney=false;
document.getElementById('gate').hidden=true; document.getElementById('app').hidden=false;
