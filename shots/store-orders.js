/* Re:Store 발주 목록. 예시 자료입니다 — 점포 연락처는 우리 것을 씁니다. */

/* ⚠ 날짜를 박아 두면 안 됩니다.
   예전에는 '2026-08-30' 처럼 적어 두었더니, 몇 달 뒤 다시 찍었을 때 목록이
   통째로 "납기 지남" 이 되어 홈페이지 대표 그림이 엉망으로 나왔습니다.
   찍는 날을 기준으로 셉니다 — 언제 다시 찍어도 늘 지금 날짜입니다. */
var 예시날=function(n){var d=new Date(); d.setDate(d.getDate()+n);
  var p=function(x){return String(x).padStart(2,'0')};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())};
var 예시시각=function(n,h,m){var p=function(x){return String(x).padStart(2,'0')};
  return 예시날(n)+'T'+p(h)+':'+p(m)+':00'};
var 예시짧은=function(n){return 예시날(n).slice(2).replace(/-/g,'')};
window.sbInit=function(){return true};
sb={channel:function(){return{on:function(){return this},subscribe:function(){}}},
    removeAllChannels:function(){}};
me={id:'u1',name:'담당자',loginId:'admin',role:'admin',companyId:'c1',
    companyCode:'GUDORO',companyName:'구도로치킨',apps:['restore']};
members=[me];
issuer={biz_no:'119-37-01707',ceo:'최환준',tel:'010-6451-5807',
        addr:'경기도 파주시 문발로 140, 301-D57호',
        bank:'국민은행 000-00-0000 디엔에이랩스',vat_rate:10};

var S=function(id,name,boss){return {id:id,name:name,boss:boss,code:name,
  tel:'010-6451-5807',addr:'경기도 파주시 문발로 140, 301-D57호',
  status:'open',memo:'',token:'t'+id,pin:'0000'}};
stores=[S('s1','판교점','김민수'),S('s2','일산점','박지은'),
        S('s3','수원인계점','이준호'),S('s4','부천중동점','정현우')];

var I=function(id,name,spec,unit,price,cat){return {id:id,name:name,spec:spec,unit:unit,
  price:price,cat:cat,code:'',active:true,taxfree:false}};
items=[I('i1','생닭 대자','10호 · 냉장','kg',7800,'육류'),
       I('i2','튀김가루','20kg','포',28000,'분말'),
       I('i3','치킨무','1.2kg','통',2400,'부재료'),
       I('i4','포장박스','대','장',380,'포장'),
       I('i5','콜라 1.25L','12입','박스',13200,'음료')];

var L=function(id,q){var i=items.find(function(x){return x.id===id});
  return {item_id:i.id,name:i.name,spec:i.spec,unit:i.unit,price:i.price,qty:q,
          ship_qty:null,taxfree:false}};
var O=function(o){return Object.assign({vat_rate:10,billed_ym:null,memo:''},o)};
orders=[
 O({id:'o1',no:'GD-'+예시짧은(0)+'-01',store_id:'s1',status:'placed',
    ordered_at:예시시각(0,8,12),want_on:예시날(1),
    lines:[L('i1',20),L('i2',2),L('i3',10),L('i4',200),L('i5',4)]}),
 O({id:'o2',no:'GD-'+예시짧은(0)+'-02',store_id:'s3',status:'placed',
    ordered_at:예시시각(0,9,40),want_on:예시날(2),
    lines:[L('i1',12),L('i3',6),L('i4',150)]}),
 O({id:'o3',no:'GD-'+예시짧은(-1)+'-04',store_id:'s2',status:'confirmed',
    ordered_at:예시시각(-1,17,5),want_on:예시날(1),
    lines:[L('i1',15),L('i2',3),L('i5',6)]}),
 O({id:'o4',no:'GD-'+예시짧은(-2)+'-01',store_id:'s4',status:'shipped',
    ordered_at:예시시각(-2,8,30),want_on:예시날(-1),
    lines:[L('i1',18),L('i3',8),L('i4',300)]}),
 O({id:'o5',no:'GD-'+예시짧은(-3)+'-02',store_id:'s1',status:'done',
    ordered_at:예시시각(-3,9,10),want_on:예시날(-2),
    lines:[L('i1',22),L('i2',2),L('i5',5)]}),
];
showApp(); go('orders'); window.scrollTo(0,0);
