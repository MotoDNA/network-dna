-- ═══════════════════════════════════════════════════════════════
-- 심사·시연용 회사(DEMO)에 예시 자료를 채웁니다
--
-- 토스페이먼츠 계약심사에 넘길 계정입니다. 우리 운영 계정(DNALABS)을 주면
-- 실제 고객 자료가 그대로 보이므로, 따로 만든 회사에 예시만 넣습니다.
--
-- ⚠ 먼저 계정이 있어야 합니다. 비밀번호는 사람이 직접 넣습니다 —
--    아래 스크립트가 화면에도 셸 기록에도 남기지 않습니다.
--
--      cd ~/Desktop/05_개발프로젝트/network-dna
--      bash setup-admin.sh
--        회사 코드   DEMO
--        회사 이름   디엔에이랩스 데모
--        아이디      demo
--        이름        데모
--        비밀번호    (10자 이상이어야 합니다)
--
--    그다음 이 파일을 돌립니다.
--
--      cd ~/Desktop/05_개발프로젝트/Rebind
--      supabase db query --linked -f ../network-dna/sql/demo_seed.sql
--
-- ⚠ 심사가 끝나면 이 회사를 정지하거나 지우세요. 밖에 나간 계정입니다.
-- ═══════════════════════════════════════════════════════════════

do $$
declare cid uuid; uid uuid;
begin
  select id into cid from public.companies where code = 'DEMO';
  if cid is null then
    raise exception 'DEMO 회사가 없습니다. 먼저 setup-admin.sh 로 회사와 계정을 만들어 주세요.';
  end if;
  select id into uid from public.profiles
   where company_id = cid and role = 'admin' order by created_at limit 1;
  if uid is null then
    raise exception 'DEMO 회사에 관리자 계정이 없습니다.';
  end if;

  -- 네 서비스를 다 열어 줍니다. 비어 있으면 어느 앱에도 못 들어갑니다.
  update public.companies
     set apps = array['rebind','recall','restore','reos']::text[]
   where id = cid;

  -- 명세서에 찍히는 우리 쪽 사업자 정보 (예시값)
  insert into public.company_settings (company_id, biz_no, ceo, tel, addr, biz_type, biz_item, bank, vat_rate)
       values (cid, '000-00-00000', '데모', '010-0000-0000',
               '서울시 ○○구 ○○로 1', '도매 및 소매업', '식자재 유통',
               '○○은행 000-000-000000 (예금주)', 10)
  on conflict (company_id) do nothing;


    delete from public.project_steps where company_id = cid and id::text like 'eb11%';
  delete from public.project_money where company_id = cid and project_id::text like 'eb11%';
  delete from public.projects     where company_id = cid and id::text like 'eb11%';
  
  insert into public.projects
    (id, company_id, owner_id, kind, name, code, client_company, client_person, client_phone, client_email,
     client_biz_no, qty, unit, spec_size, spec_pages, spec_color, spec_paper_cover, spec_paper_inner,
     spec_bind, spec_finish, status, started_on, due_on, done_on, arrivals) values
   ('eb110000-0000-4000-8000-000000000001', cid, uid, 'project',
    '2027 하드커버 다이어리', 'BL-2708', '블루밍문구', '김민수 과장', '010-6451-5807', 'hello@dnalabs.kr',
    '119-37-01707', 3000, '부', '국배판 148×210', 208, '표지 4도 / 내지 1도', '스노우지 250g', '모조지 80g',
    '양장', '무광코팅 · 박', 'running', current_date - 24, current_date + 12, null,
    '[{"n":"표지 용지","s":"스노우지 250g","on":null},{"n":"내지 용지","s":"모조지 80g","on":null}]'::jsonb),
   ('eb110000-0000-4000-8000-000000000002', cid, uid, 'project',
    '회사소개 브로슈어', 'AC-0812', '액티바코리아', '박지은 대리', '010-6451-5807', 'hello@dnalabs.kr',
    '119-37-01707', 1000, '부', 'A4', 24, '양면 4도', '아트지 200g', '아트지 150g',
    '중철', '무광코팅', 'running', current_date - 18, current_date + 4, null,
    '[{"n":"표지 용지","s":"아트지 200g","on":null},{"n":"내지 용지","s":"","on":null}]'::jsonb),
   ('eb110000-0000-4000-8000-000000000003', cid, uid, 'project',
    '제품 카탈로그 2026', 'DH-0730', '대한제본', '이준호 팀장', '010-6451-5807', 'hello@dnalabs.kr',
    '119-37-01707', 500, '부', '국배판', 64, '양면 4도', '스노우지 200g', '스노우지 120g',
    '무선', '유광코팅', 'done', current_date - 40, current_date - 4, current_date - 3, '[]'::jsonb),
   ('eb110000-0000-4000-8000-000000000004', cid, uid, 'project',
    '단어장 (스프링)', 'HS-0805', '한솔제지', '정현우 과장', '010-6451-5807', 'hello@dnalabs.kr',
    '119-37-01707', 2000, '부', 'A6', 128, '1도', '아르떼 210g', '모조지 70g',
    '트윈링', '귀도리', 'ready', null, current_date + 25, null, '[]'::jsonb),
   ('eb110000-0000-4000-8000-000000000005', cid, uid, 'project',
    '사보 9월호', 'GR-0901', '그린라이프', '최서연 대리', '010-6451-5807', 'hello@dnalabs.kr',
    '119-37-01707', 1500, '부', '국배판', 48, '양면 4도', '스노우지 180g', '모조지 100g',
    '중철', '무광코팅', 'running', current_date - 15, current_date - 2, null,
    '[{"n":"표지 용지","s":"스노우지 180g","on":null}]'::jsonb);
  
  -- 자재가 실제로 언제 들어왔는지. 날짜가 박히면 안 되니 넣은 뒤에 셈해 채웁니다.
  update public.projects set arrivals = jsonb_set(jsonb_set(arrivals,
      '{0,on}', to_jsonb((current_date - 18)::text)),
      '{1,on}', to_jsonb((current_date - 16)::text))
   where id = 'eb110000-0000-4000-8000-000000000001';
  update public.projects set arrivals = jsonb_set(arrivals,
      '{0,on}', to_jsonb((current_date - 9)::text))
   where id = 'eb110000-0000-4000-8000-000000000002';
  update public.projects set arrivals = jsonb_set(arrivals,
      '{0,on}', to_jsonb((current_date - 11)::text))
   where id = 'eb110000-0000-4000-8000-000000000005';
  
  -- 공정 기록. 진행률은 마지막 줄의 percent 를 따라갑니다.
  insert into public.project_steps (id, company_id, project_id, name, percent, at, note, by_id) values
   ('eb110000-0000-4000-8000-000000000101', cid, 'eb110000-0000-4000-8000-000000000001', '파일 입고 · 검수', 10, current_date - 22, '', uid),
   ('eb110000-0000-4000-8000-000000000102', cid, 'eb110000-0000-4000-8000-000000000001', '인쇄',            35, current_date - 15, '표지 4도 완료', uid),
   ('eb110000-0000-4000-8000-000000000103', cid, 'eb110000-0000-4000-8000-000000000001', '접지',            55, current_date - 9,  '', uid),
   ('eb110000-0000-4000-8000-000000000104', cid, 'eb110000-0000-4000-8000-000000000001', '정합',            70, current_date - 5,  '208면 확인', uid),
   ('eb110000-0000-4000-8000-000000000105', cid, 'eb110000-0000-4000-8000-000000000002', '파일 입고 · 검수', 10, current_date - 16, '', uid),
   ('eb110000-0000-4000-8000-000000000106', cid, 'eb110000-0000-4000-8000-000000000002', '인쇄',            40, current_date - 6,  '', uid),
   ('eb110000-0000-4000-8000-000000000107', cid, 'eb110000-0000-4000-8000-000000000003', '출고 · 납품',    100, current_date - 3,  '500부 전량', uid),
   ('eb110000-0000-4000-8000-000000000108', cid, 'eb110000-0000-4000-8000-000000000005', '인쇄',            45, current_date - 8,  '', uid),
   ('eb110000-0000-4000-8000-000000000109', cid, 'eb110000-0000-4000-8000-000000000005', '제본',            75, current_date - 2,  '표지 재입고 대기', uid);
  
  -- 돈. 단가와 원가는 관리자만 봅니다(project_money 를 따로 둔 이유).
  insert into public.project_money (project_id, company_id, unit_price, vat_rate, extra_items, cost_items, billed_on, taxed_on, paid_on) values
   ('eb110000-0000-4000-8000-000000000001', cid, 4800, 10, '[]'::jsonb,
    '[{"n":"표지 인쇄","q":1,"p":420000,"u":"식"},{"n":"내지 인쇄","q":1,"p":1850000,"u":"식"},{"n":"제본","q":3000,"p":620,"u":"부"}]'::jsonb, null, null, null),
   ('eb110000-0000-4000-8000-000000000002', cid, 2200, 10, '[]'::jsonb,
    '[{"n":"인쇄","q":1,"p":560000,"u":"식"},{"n":"용지","q":1,"p":310000,"u":"식"},{"n":"중철","q":1000,"p":180,"u":"부"}]'::jsonb, null, null, null),
   ('eb110000-0000-4000-8000-000000000003', cid, 3500, 10, '[]'::jsonb,
    '[{"n":"인쇄","q":1,"p":480000,"u":"식"},{"n":"무선제본","q":500,"p":700,"u":"부"}]'::jsonb, current_date - 3, current_date - 3, null),
   ('eb110000-0000-4000-8000-000000000004', cid, 1600, 10, '[]'::jsonb, '[]'::jsonb, null, null, null),
   ('eb110000-0000-4000-8000-000000000005', cid, 2900, 10, '[]'::jsonb,
    '[{"n":"인쇄","q":1,"p":740000,"u":"식"},{"n":"용지","q":1,"p":395000,"u":"식"}]'::jsonb, null, null, null);

    delete from public.order_lines  where company_id = cid and id::text like 'e514%';
  delete from public.orders       where company_id = cid and id::text like 'e513%';
  delete from public.supply_items where company_id = cid and id::text like 'e512%';
  delete from public.stores       where company_id = cid and id::text like 'e511%';
  
  -- ── 점포 다섯 ──
  -- ⚠ 핀을 반드시 넣습니다. 글로만 "링크는 꺼 둡니다" 라고 적어 놓고 칸을 안 넣었다가,
  --    share_on 의 기본값이 true 라서 핀 없는 링크 다섯 개가 그대로 살아 있었습니다.
  --    링크는 핀이 있어야 자물쇠가 됩니다 — 말이 아니라 칸으로 못 박습니다.
  insert into public.stores
    (id, company_id, owner_id, code, name, boss, phone, addr, biz_no, biz_name,
     opened_on, status, pay_term, pin, share_on, memo) values
   ('e5110000-0000-4000-8000-000000000001', cid, uid, 'ST-001', '판교점',    '김도현', '010-6451-5807', '경기도 성남시 분당구 판교로 100',  '119-37-01707', '판교점',    current_date - 700, 'open',  'month', lpad((floor(random()*1000000))::int::text, 6, '0'), true, ''),
   ('e5110000-0000-4000-8000-000000000002', cid, uid, 'ST-002', '수원인계점', '이수진', '010-6451-5807', '경기도 수원시 팔달구 인계로 20',   '119-37-01707', '수원인계점', current_date - 520, 'open',  'month', lpad((floor(random()*1000000))::int::text, 6, '0'), true, ''),
   ('e5110000-0000-4000-8000-000000000003', cid, uid, 'ST-003', '일산점',    '박정우', '010-6451-5807', '경기도 고양시 일산동구 중앙로 30', '119-37-01707', '일산점',    current_date - 430, 'open',  'month', lpad((floor(random()*1000000))::int::text, 6, '0'), true, ''),
   ('e5110000-0000-4000-8000-000000000004', cid, uid, 'ST-004', '부천중동점', '최은영', '010-6451-5807', '경기도 부천시 원미구 길주로 40',   '119-37-01707', '부천중동점', current_date - 260, 'open',  'each', lpad((floor(random()*1000000))::int::text, 6, '0'), true, ''),
   ('e5110000-0000-4000-8000-000000000005', cid, uid, 'ST-005', '강남역점',  '정민석', '010-6451-5807', '서울시 강남구 강남대로 396',       '119-37-01707', '강남역점',  current_date - 95,  'open',  'month', lpad((floor(random()*1000000))::int::text, 6, '0'), true, '신규 점포 — 첫 3개월 단가 협의');
  
  -- ── 품목 ──
  insert into public.supply_items
    (id, company_id, code, name, spec, unit, category, price, taxfree, moq, box_qty, active, sort) values
   ('e5120000-0000-4000-8000-000000000001', cid, 'IT-001', '생닭 대자',  '10호 · 냉장', '마리', '육류',   7800,  true,  10, 10, true, 1),
   ('e5120000-0000-4000-8000-000000000002', cid, 'IT-002', '튀김가루',   '20kg',        '포',   '분말',   28000, false, 1,  1,  true, 2),
   ('e5120000-0000-4000-8000-000000000003', cid, 'IT-003', '치킨무',     '1.2kg',       '통',   '부재료', 2400,  false, 5,  10, true, 3),
   ('e5120000-0000-4000-8000-000000000004', cid, 'IT-004', '포장박스 대', '대',          '장',   '포장',   380,   false, 50, 100,true, 4),
   ('e5120000-0000-4000-8000-000000000005', cid, 'IT-005', '콜라 1.25L', '12입',        '박스', '음료',   13200, false, 1,  1,  true, 5),
   ('e5120000-0000-4000-8000-000000000006', cid, 'IT-006', '양념소스',   '5kg',         '통',   '소스',   19500, false, 2,  4,  true, 6),
   ('e5120000-0000-4000-8000-000000000007', cid, 'IT-007', '종이컵',     '6.5oz 1000입', '박스', '포장',   16800, false, 1,  1,  true, 7),
   ('e5120000-0000-4000-8000-000000000008', cid, 'IT-008', '위생장갑',   '100매',       '박스', '소모품', 4300,  false, 5,  20, true, 8);
  
  -- ── 발주 다섯 — 접수부터 완료까지 한 줄에 다 보이게 ──
  insert into public.orders
    (id, company_id, store_id, no, ordered_at, want_on, status,
     confirmed_on, shipped_on, done_on, courier, invoice_no, memo, memo_hq, vat_rate, by_store, billed_ym) values
   ('e5130000-0000-4000-8000-000000000001', cid, 'e5110000-0000-4000-8000-000000000001',
    to_char(current_date - 1,'YYYYMMDD')||'-001', now() - interval '1 day',  current_date + 2, 'placed',
    null, null, null, '', '', '금요일 오전까지 부탁드립니다', '', 10, true,  null),
   ('e5130000-0000-4000-8000-000000000002', cid, 'e5110000-0000-4000-8000-000000000002',
    to_char(current_date - 1,'YYYYMMDD')||'-002', now() - interval '1 day',  current_date + 3, 'placed',
    null, null, null, '', '', '', '', 10, true,  null),
   ('e5130000-0000-4000-8000-000000000003', cid, 'e5110000-0000-4000-8000-000000000003',
    to_char(current_date - 3,'YYYYMMDD')||'-001', now() - interval '3 day',  current_date + 1, 'confirmed',
    current_date - 2, null, null, '', '', '', '치킨무 재고 확인 후 출고', 10, true,  null),
   ('e5130000-0000-4000-8000-000000000004', cid, 'e5110000-0000-4000-8000-000000000004',
    to_char(current_date - 5,'YYYYMMDD')||'-001', now() - interval '5 day',  current_date - 1, 'shipped',
    current_date - 4, current_date - 1, null, '대한통운', '1234-5678-9012', '', '', 10, false, null),
   ('e5130000-0000-4000-8000-000000000005', cid, 'e5110000-0000-4000-8000-000000000005',
    to_char(current_date - 12,'YYYYMMDD')||'-001', now() - interval '12 day', current_date - 8, 'done',
    current_date - 11, current_date - 9, current_date - 8, '대한통운', '1234-5678-9001', '', '', 10, true,
    to_char(current_date - 8,'YYYY-MM'));
  
  -- ── 발주 속 품목 ──
  -- 단가는 품목표를 보는 것이 아니라 **그때 그 값을 줄에 박아 둡니다.**
  -- 나중에 단가를 올려도 지난 청구서 금액이 바뀌면 안 됩니다.
  insert into public.order_lines
    (id, company_id, order_id, item_id, name, spec, unit, price, taxfree, qty, ship_qty, note, sort) values
   ('e5140000-0000-4000-8000-000000000001', cid, 'e5130000-0000-4000-8000-000000000001', 'e5120000-0000-4000-8000-000000000001', '생닭 대자',  '10호 · 냉장', '마리', 7800,  true,  20,  null, '', 1),
   ('e5140000-0000-4000-8000-000000000002', cid, 'e5130000-0000-4000-8000-000000000001', 'e5120000-0000-4000-8000-000000000002', '튀김가루',   '20kg',        '포',   28000, false, 2,   null, '', 2),
   ('e5140000-0000-4000-8000-000000000003', cid, 'e5130000-0000-4000-8000-000000000001', 'e5120000-0000-4000-8000-000000000003', '치킨무',     '1.2kg',       '통',   2400,  false, 10,  null, '', 3),
   ('e5140000-0000-4000-8000-000000000004', cid, 'e5130000-0000-4000-8000-000000000001', 'e5120000-0000-4000-8000-000000000004', '포장박스 대', '대',          '장',   380,   false, 200, null, '', 4),
   ('e5140000-0000-4000-8000-000000000005', cid, 'e5130000-0000-4000-8000-000000000001', 'e5120000-0000-4000-8000-000000000005', '콜라 1.25L', '12입',        '박스', 13200, false, 4,   null, '', 5),
  
   ('e5140000-0000-4000-8000-000000000006', cid, 'e5130000-0000-4000-8000-000000000002', 'e5120000-0000-4000-8000-000000000001', '생닭 대자',  '10호 · 냉장', '마리', 7800,  true,  12,  null, '', 1),
   ('e5140000-0000-4000-8000-000000000007', cid, 'e5130000-0000-4000-8000-000000000002', 'e5120000-0000-4000-8000-000000000003', '치킨무',     '1.2kg',       '통',   2400,  false, 6,   null, '', 2),
   ('e5140000-0000-4000-8000-000000000008', cid, 'e5130000-0000-4000-8000-000000000002', 'e5120000-0000-4000-8000-000000000004', '포장박스 대', '대',          '장',   380,   false, 150, null, '', 3),
  
   ('e5140000-0000-4000-8000-000000000009', cid, 'e5130000-0000-4000-8000-000000000003', 'e5120000-0000-4000-8000-000000000001', '생닭 대자',  '10호 · 냉장', '마리', 7800,  true,  15,  null, '', 1),
   ('e5140000-0000-4000-8000-00000000000a', cid, 'e5130000-0000-4000-8000-000000000003', 'e5120000-0000-4000-8000-000000000002', '튀김가루',   '20kg',        '포',   28000, false, 3,   null, '', 2),
   ('e5140000-0000-4000-8000-00000000000b', cid, 'e5130000-0000-4000-8000-000000000003', 'e5120000-0000-4000-8000-000000000005', '콜라 1.25L', '12입',        '박스', 13200, false, 6,   null, '', 3),
  
   -- 출고 건: 주문한 양과 **실제로 나간 양**이 다릅니다. 치킨무가 네 통 모자랐습니다.
   ('e5140000-0000-4000-8000-00000000000c', cid, 'e5130000-0000-4000-8000-000000000004', 'e5120000-0000-4000-8000-000000000001', '생닭 대자',  '10호 · 냉장', '마리', 7800,  true,  18,  18,  '', 1),
   ('e5140000-0000-4000-8000-00000000000d', cid, 'e5130000-0000-4000-8000-000000000004', 'e5120000-0000-4000-8000-000000000003', '치킨무',     '1.2kg',       '통',   2400,  false, 8,   4,   '재고 부족 — 4통만 출고', 2),
   ('e5140000-0000-4000-8000-00000000000e', cid, 'e5130000-0000-4000-8000-000000000004', 'e5120000-0000-4000-8000-000000000004', '포장박스 대', '대',          '장',   380,   false, 300, 300, '', 3),
  
   ('e5140000-0000-4000-8000-00000000000f', cid, 'e5130000-0000-4000-8000-000000000005', 'e5120000-0000-4000-8000-000000000001', '생닭 대자',  '10호 · 냉장', '마리', 7800,  true,  25,  25,  '', 1),
   ('e5140000-0000-4000-8000-000000000010', cid, 'e5130000-0000-4000-8000-000000000005', 'e5120000-0000-4000-8000-000000000006', '양념소스',   '5kg',         '통',   19500, false, 4,   4,   '', 2),
   ('e5140000-0000-4000-8000-000000000011', cid, 'e5130000-0000-4000-8000-000000000005', 'e5120000-0000-4000-8000-000000000007', '종이컵',     '6.5oz 1000입', '박스', 16800, false, 2,   2,   '', 3);

    delete from public.os_activity   where company_id = cid and id::text like 'e61%';
  delete from public.os_tasks      where company_id = cid and id::text like 'e61%';
  delete from public.os_cost_items where company_id = cid and id::text like 'e61%';
  delete from public.os_money      where company_id = cid and project_id::text like 'e613%';
  delete from public.os_projects   where company_id = cid and id::text like 'e613%';
  delete from public.os_suppliers  where company_id = cid and id::text like 'e612%';
  delete from public.os_customers  where company_id = cid and id::text like 'e611%';
  
  -- ── 고객사 셋 ──
  insert into public.os_customers
    (id, company_id, owner_id, code, name, biz_no, biz_name, biz_ceo, phone, email, addr, contacts, pay_term, status, memo) values
   ('e6110000-0000-4000-8000-000000000001', cid, uid, 'CU-001', '블루밍문구', '119-37-01707', '블루밍문구', '최환준', '010-6451-5807', 'hello@dnalabs.kr', '서울시 마포구 양화로 10',
    '[{"name":"김민수","title":"과장","phone":"010-6451-5807","email":"hello@dnalabs.kr"}]'::jsonb, '납품 후 30일', 'active', ''),
   ('e6110000-0000-4000-8000-000000000002', cid, uid, 'CU-002', '액티바코리아', '119-37-01707', '액티바코리아', '최환준', '010-6451-5807', 'hello@dnalabs.kr', '경기도 성남시 분당구 판교로 100',
    '[{"name":"박지은","title":"대리","phone":"010-6451-5807","email":"hello@dnalabs.kr"}]'::jsonb, '월말 마감', 'active', ''),
   ('e6110000-0000-4000-8000-000000000003', cid, uid, 'CU-003', '그린라이프', '119-37-01707', '그린라이프', '최환준', '010-6451-5807', 'hello@dnalabs.kr', '경기도 파주시 문발로 140',
    '[{"name":"이준호","title":"팀장","phone":"010-6451-5807","email":"hello@dnalabs.kr"}]'::jsonb, '선금 50%%', 'active', '');
  
  -- ── 외주업체 셋 ──
  -- caps 는 "무엇을 할 수 있나" 입니다. 업체를 고를 때 이것으로 거릅니다.
  insert into public.os_suppliers
    (id, company_id, code, name, biz_no, ceo, contact_name, phone, email, addr, caps, moq, lead_days, pay_term, status, memo) values
   ('e6120000-0000-4000-8000-000000000001', cid, 'SP-001', '한솔인쇄',   '119-37-01707', '최환준', '정현우', '010-6451-5807', 'hello@dnalabs.kr', '경기도 파주시 문발로 140',
    array['옵셋','무선제본','라미네이팅'], 3000, 21, '납품 후 30일', 'active', ''),
   ('e6120000-0000-4000-8000-000000000002', cid, 'SP-002', '대한제본',   '119-37-01707', '최환준', '김서연', '010-6451-5807', 'hello@dnalabs.kr', '서울시 중구 을지로 100',
    array['양장','PUR','박'],            5000, 28, '선금 50%%',     'active', ''),
   ('e6120000-0000-4000-8000-000000000003', cid, 'SP-003', '우진패키지', '119-37-01707', '최환준', '최서연', '010-6451-5807', 'hello@dnalabs.kr', '인천시 서구 가좌로 20',
    array['단상자','싸바리','톰슨'],      2000, 25, '납품 후 15일', 'active', '');
  
  -- ── 프로젝트 다섯 — 단계가 골고루 흩어지게 ──
  insert into public.os_projects
    (id, company_id, owner_id, code, name, customer_id, contact_name, category, status, priority,
     started_on, due_on, delivered_on, qty_plan, qty_final, tags, memo) values
   ('e6130000-0000-4000-8000-000000000001', cid, uid, 'PRJ-2026-0041', '2027 데스크 다이어리', 'e6110000-0000-4000-8000-000000000001', '김민수 과장',
    'diary',      'ordered',    'high',   current_date - 24, current_date + 18, null, 5000, 5000, array['연말','재주문'], ''),
   ('e6130000-0000-4000-8000-000000000002', cid, uid, 'PRJ-2026-0043', '브랜드 노트 3종 세트', 'e6110000-0000-4000-8000-000000000002', '박지은 대리',
    'note',       'sample',     'normal', current_date - 16, current_date + 25, null, 3000, null, array['신규'], ''),
   ('e6130000-0000-4000-8000-000000000003', cid, uid, 'PRJ-2026-0044', '선물용 단상자 패키지', 'e6110000-0000-4000-8000-000000000003', '이준호 팀장',
    'package',    'review',     'high',   current_date - 20, current_date + 9,  null, 2000, null, array['승인대기'], '컬러 확인 중'),
   ('e6130000-0000-4000-8000-000000000004', cid, uid, 'PRJ-2026-0038', '스케치북 A4 (스프링)', 'e6110000-0000-4000-8000-000000000001', '김민수 과장',
    'sketchbook', 'production', 'normal', current_date - 38, current_date + 5,  null, 1500, 1500, array['재주문'], ''),
   ('e6130000-0000-4000-8000-000000000005', cid, uid, 'PRJ-2026-0031', '2026 탁상 캘린더',   'e6110000-0000-4000-8000-000000000003', '이준호 팀장',
    'goods',      'done',       'normal', current_date - 95, current_date - 12, current_date - 13, 4000, 4000, array['완료'], '');
  
  -- ── 돈 ──
  -- ⚠ os_projects 에는 금액 칸이 없습니다. 직원도 읽는 표이기 때문입니다.
  --    판매금액과 원가는 딴 표에 두고 관리자만 읽습니다(os_money_ok).
  insert into public.os_money (project_id, company_id, sales_amount, vat_rate, memo) values
   ('e6130000-0000-4000-8000-000000000001', cid, 9800000, 10, ''),
   ('e6130000-0000-4000-8000-000000000002', cid, 5400000, 10, ''),
   ('e6130000-0000-4000-8000-000000000003', cid, 4200000, 10, ''),
   ('e6130000-0000-4000-8000-000000000004', cid, 2700000, 10, ''),
   ('e6130000-0000-4000-8000-000000000005', cid, 6000000, 10, '');
  
  -- ── 원가 — 예상 · 확정 · 실제 세 자리 ──
  -- ⚠ 세 칸 모두 not null 입니다(기본값 0). 아직 없는 값은 null 이 아니라 0 으로 둡니다 —
  --    앱이 act || fix || est 로 고르기 때문에 0 이 곧 "아직 없음" 입니다.
  -- 예상만 있는 줄, 확정까지 간 줄, 실제까지 찍힌 줄이 섞여 있어야
  -- "예상보다 얼마나 넘었나" 가 화면에 보입니다.
  insert into public.os_cost_items
    (id, company_id, project_id, supplier_id, category, title, qty, unit_price, est_amount, fix_amount, act_amount, memo, sort) values
   ('e6140000-0000-4000-8000-000000000001', cid, 'e6130000-0000-4000-8000-000000000001', 'e6120000-0000-4000-8000-000000000001', 'outsource', '외주 제작비', 5000, 1240, 6000000, 6200000, 0, '', 1),
   ('e6140000-0000-4000-8000-000000000002', cid, 'e6130000-0000-4000-8000-000000000001', 'e6120000-0000-4000-8000-000000000001', 'sample',    '샘플 제작비', 1,    150000, 150000, 150000, 150000, '', 2),
   ('e6140000-0000-4000-8000-000000000003', cid, 'e6130000-0000-4000-8000-000000000002', null,                                   'outsource', '외주 제작비', 3000, 1100, 3300000, 0, 0, '견적 비교 중', 1),
   ('e6140000-0000-4000-8000-000000000004', cid, 'e6130000-0000-4000-8000-000000000003', 'e6120000-0000-4000-8000-000000000003', 'outsource', '외주 제작비', 2000, 1300, 2600000, 2600000, 0, '', 1),
   ('e6140000-0000-4000-8000-000000000005', cid, 'e6130000-0000-4000-8000-000000000003', 'e6120000-0000-4000-8000-000000000003', 'mold',      '금형비',      1,    380000, 380000, 380000, 0, '', 2),
   ('e6140000-0000-4000-8000-000000000006', cid, 'e6130000-0000-4000-8000-000000000004', 'e6120000-0000-4000-8000-000000000001', 'outsource', '외주 제작비', 1500, 1000, 1500000, 1500000, 1560000, '용지 값이 올랐습니다', 1),
   ('e6140000-0000-4000-8000-000000000007', cid, 'e6130000-0000-4000-8000-000000000005', 'e6120000-0000-4000-8000-000000000002', 'outsource', '외주 제작비', 4000, 900,  3600000, 3600000, 3600000, '', 1),
   ('e6140000-0000-4000-8000-000000000008', cid, 'e6130000-0000-4000-8000-000000000005', null,                                   'ship',      '운송비',      1,    180000, 180000, 180000, 195000, '', 2);
  
  -- ── 할 일 ──
  insert into public.os_tasks
    (id, company_id, project_id, supplier_id, title, assignee_id, due_on, priority, done, memo, created_by) values
   ('e6150000-0000-4000-8000-000000000001', cid, 'e6130000-0000-4000-8000-000000000003', null, '고객 승인 회신 확인 전화', uid, current_date,     'high',   false, '', uid),
   ('e6150000-0000-4000-8000-000000000002', cid, 'e6130000-0000-4000-8000-000000000001', 'e6120000-0000-4000-8000-000000000001', '표지 컬러 샘플 수령', uid, current_date + 2, 'normal', false, '', uid),
   ('e6150000-0000-4000-8000-000000000003', cid, 'e6130000-0000-4000-8000-000000000002', null, '견적서 2안 보내기',       uid, current_date + 3, 'normal', false, '', uid),
   ('e6150000-0000-4000-8000-000000000004', cid, 'e6130000-0000-4000-8000-000000000004', null, '생산 진행률 확인',        uid, current_date - 1, 'urgent', false, '', uid),
   ('e6150000-0000-4000-8000-000000000005', cid, 'e6130000-0000-4000-8000-000000000005', null, '정산서 발행',             uid, current_date - 10,'normal', true,  '', uid);
  
  -- ── 활동 기록 ──
  -- 사람이 따로 적지 않아도 쌓이는 것들입니다. 예시에서는 손으로 넣습니다.
  insert into public.os_activity (id, company_id, project_id, kind, body, by_id, by_name, at) values
   ('e6160000-0000-4000-8000-000000000001', cid, 'e6130000-0000-4000-8000-000000000001', 'po',       '한솔인쇄에 발주서를 보냈습니다',   uid, '최환준', now() - interval '2 hour'),
   ('e6160000-0000-4000-8000-000000000002', cid, 'e6130000-0000-4000-8000-000000000003', 'approval', '고객 승인을 요청했습니다',        uid, '최환준', now() - interval '26 hour'),
   ('e6160000-0000-4000-8000-000000000003', cid, 'e6130000-0000-4000-8000-000000000002', 'sample',   '1차 샘플을 등록했습니다',        uid, '최환준', now() - interval '50 hour'),
   ('e6160000-0000-4000-8000-000000000004', cid, 'e6130000-0000-4000-8000-000000000004', 'status',   '생산 단계로 넘겼습니다',          uid, '최환준', now() - interval '72 hour'),
   ('e6160000-0000-4000-8000-000000000005', cid, 'e6130000-0000-4000-8000-000000000001', 'rfq',      '견적을 확정했습니다 — 한솔인쇄',  uid, '최환준', now() - interval '80 hour'),
   ('e6160000-0000-4000-8000-000000000006', cid, 'e6130000-0000-4000-8000-000000000004', 'cost',     '실제 원가가 확정보다 60,000원 늘었습니다', uid, '최환준', now() - interval '96 hour'),
   ('e6160000-0000-4000-8000-000000000007', cid, 'e6130000-0000-4000-8000-000000000005', 'status',   '종료로 넘겼습니다',               uid, '최환준', now() - interval '12 day');

end $$;

select c.code, c.name, c.apps,
       (select count(*) from public.projects    where company_id=c.id and not deleted) as "Re:Bind 프로젝트",
       (select count(*) from public.stores      where company_id=c.id and not deleted) as "Re:Store 점포",
       (select count(*) from public.orders      where company_id=c.id and not deleted) as "Re:Store 발주",
       (select count(*) from public.os_projects where company_id=c.id and not deleted) as "Re:O-S 프로젝트"
  from public.companies c where c.code='DEMO';
