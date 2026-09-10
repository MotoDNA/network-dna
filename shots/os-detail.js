/* 프로젝트 하나의 외주 탭 — 업체 셋의 견적을 한 표에서 견주는 자리. 이 앱이 Re:Bind 와 다른 점이 여기 있습니다. */
window.pullOne=async function(pid){ cur={id:pid,
  specs:[{id:'sp1',project_id:pid,ver:2,is_final:true},{id:'sp0',project_id:pid,ver:1,is_final:false}],
  quotes:[{id:'q1',project_id:pid,ver:1,status:'won'}], qmoney:{q1:{quote_id:'q1',total:9800000}},
  rfqs:[{id:'r1',project_id:pid,supplier_id:'s1',status:'won',    sent_on:d(-14),reply_due:d(-9),lead_days:21,moq:3000,pay_term:'납품 후 30일'},
        {id:'r2',project_id:pid,supplier_id:'s2',status:'lost',   sent_on:d(-14),reply_due:d(-9),lead_days:28,moq:5000,pay_term:'선금 50%'},
        {id:'r3',project_id:pid,supplier_id:'s3',status:'replied',sent_on:d(-14),reply_due:d(-9),lead_days:25,moq:2000,pay_term:'납품 후 15일'}],
  rmoney:{r1:{rfq_id:'r1',make_cost:6200000,sample_cost:150000,mold_cost:0,unit_price:1240},
          r2:{rfq_id:'r2',make_cost:6900000,sample_cost:200000,mold_cost:0,unit_price:1380},
          r3:{rfq_id:'r3',make_cost:6500000,sample_cost:120000,mold_cost:0,unit_price:1300}},
  pos:[{id:'o1',project_id:pid,supplier_id:'s1',no:'PO-2026-0041-1',status:'making',due_on:d(14),qty:5000,sent_on:d(-3)}],
  pmoney:{o1:{po_id:'o1',total:6200000}},
  samples:[{id:'sa1',project_id:pid,kind:'s1',status:'approved',plan_on:d(-6)}],
  proofs:[], approvals:[], files:[{id:'f1',name:'표지_최종.pdf',is_final:true,folder:'02_DESIGN'}],
  costs:D.costs.filter(function(c){return c.project_id===pid}),
  tasks:D.tasks.filter(function(t){return t.project_id===pid}),
  acts:D.acts.filter(function(a){return a.project_id===pid}) };
  return cur; };
go('prjs');
openPrj('p1','out').then(function(){
  /* 단계 줄이 위에 오도록 내립니다. 위쪽 막대가 붙박이로 덮으니 그만큼 남겨 둡니다. */
  var 판=document.getElementById('detail'), 줄=판.querySelector('.stage');
  /* 덮는 화면이 스스로 굴러가면 그것을, 아니면 창을 굴립니다 — 둘 다 굴리면 두 배로 내려가 단계 줄이 잘립니다(겪었습니다) */
  if(줄){ var y=줄.getBoundingClientRect().top-58, 전=판.scrollTop; 판.scrollTop+=y; if(판.scrollTop===전) window.scrollBy(0,y); }
});
