-- Re:Call 예시 자료를 DEMO 회사에 채웁니다.
-- 고객카드·활동 기록은 지난번에 화면에서 만든 것이라 씨앗 SQL 에 없었습니다.
-- 우리 회사(DNALABS)의 예시 줄만 골라 옮겨 담습니다 — 나중에 손으로 만든 줄은 빼고.
do $$
declare cid uuid; uid uuid; src uuid;
begin
  select id into cid from public.companies where code='DEMO';
  if cid is null then raise exception 'DEMO 회사가 없습니다.'; end if;
  select id into uid from public.profiles where company_id=cid and role='admin' order by created_at limit 1;
  select id into src from public.companies where code='DNALABS';

  delete from public.activities where company_id=cid;
  delete from public.customers  where company_id=cid;

  insert into public.customers
    (id, company_id, owner_id, shared_ids, name, company_name, title, phone, email, addr,
     groups, last_at, visibility, created_at, updated_at, deleted)
  select replace(id::text,'de11','ee11')::uuid, cid, uid, '{}', name, company_name, title, phone, email, addr,
         groups, last_at, visibility, created_at, updated_at, false
    from public.customers
   where company_id=src and id::text like 'de11%' and not deleted;

  -- 활동 기록의 id 는 손으로 만든 것이라 규칙이 없습니다. 새로 뽑습니다.
  insert into public.activities
    (id, company_id, customer_id, kind, body, at, due, done, by_id, created_at, updated_at, deleted)
  select gen_random_uuid(), cid, replace(a.customer_id::text,'de11','ee11')::uuid,
         a.kind, a.body, a.at, a.due, a.done, uid, a.created_at, a.updated_at, false
    from public.activities a
   where a.company_id=src and a.customer_id::text like 'de11%' and not a.deleted;

  -- 심사관에게 보일 이름입니다. 거래명세서의 '공급자' 상호로도 찍힙니다.
  update public.companies set name='디엔에이랩스 데모' where id=cid and name='demo';
end $$;

select c.name as 회사,
       (select count(*) from public.customers  where company_id=c.id and not deleted) as "Re:Call 고객",
       (select count(*) from public.activities where company_id=c.id and not deleted) as "활동 기록"
  from public.companies c where c.code='DEMO';
