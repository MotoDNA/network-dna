-- ═══════════════════════════════════════════════════════════════
-- 접근 제어 시험
--
-- Supabase → SQL Editor 에 통째로 붙여넣고 실행하세요.
-- 마지막에 "모든 시험 통과" 가 나오면 정상입니다.
-- 어느 하나라도 뚫리면 그 자리에서 오류를 내고 멈춥니다.
--
-- 트랜잭션 안에서 돌고 끝나면 되돌리므로 실제 데이터는 남지 않습니다.
-- ═══════════════════════════════════════════════════════════════
begin;

-- ── 시험용 회사 둘, 사람 셋 ──
-- A사: 관리자 1, 영업 2   /   B사: 영업 1
do $$
declare
  ca uuid; cb uuid;
  ua uuid := gen_random_uuid();   -- A사 관리자
  u1 uuid := gen_random_uuid();   -- A사 영업1
  u2 uuid := gen_random_uuid();   -- A사 영업2
  ub uuid := gen_random_uuid();   -- B사 영업
  k1 uuid; k2 uuid; kb uuid;
begin
  insert into public.companies(code, name) values ('TESTAA','시험A') returning id into ca;
  insert into public.companies(code, name) values ('TESTBB','시험B') returning id into cb;

  insert into auth.users(id, instance_id, aud, role, email, encrypted_password,
                         email_confirmed_at, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         x.em, crypt('testpassword', gen_salt('bf')), now(), now(), now()
    from (values (ua,'a-admin@testaa.ndna.invalid'), (u1,'a-one@testaa.ndna.invalid'),
                 (u2,'a-two@testaa.ndna.invalid'),   (ub,'b-one@testbb.ndna.invalid')) as x(id, em);

  insert into public.profiles(id, company_id, login_id, name, role) values
    (ua, ca, 'aadmin', 'A관리자', 'admin'),
    (u1, ca, 'aone',   'A영업1',  'user'),
    (u2, ca, 'atwo',   'A영업2',  'user'),
    (ub, cb, 'bone',   'B영업',   'user');

  -- A사 고객 둘: 하나는 영업1 담당, 하나는 영업1 담당인데 영업2에게 공유
  insert into public.customers(company_id, owner_id, name, company_name)
    values (ca, u1, '김담당', 'A고객사1') returning id into k1;
  insert into public.customers(company_id, owner_id, shared_ids, name, company_name)
    values (ca, u1, array[u2], '박공유', 'A고객사2') returning id into k2;
  -- B사 고객 하나
  insert into public.customers(company_id, owner_id, name, company_name)
    values (cb, ub, '최비밀', 'B고객사') returning id into kb;

  insert into public.activities(company_id, customer_id, kind, body, by_id) values
    (ca, k1, 'meeting', 'A사 기록1', u1),
    (ca, k2, 'meeting', 'A사 기록2', u1),
    (cb, kb, 'meeting', 'B사 기록',  ub);

  -- 나중에 쓰려고 남겨 둡니다
  create temp table t_ids on commit drop as
    select ca ca, cb cb, ua ua, u1 u1, u2 u2, ub ub, k1 k1, k2 k2, kb kb;
end $$;

-- ── 특정 사용자로 가장하는 도우미 ──
create or replace function pg_temp.act_as(p uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.expect(cond boolean, msg text) returns void
language plpgsql as $$
begin
  if not cond then raise exception '시험 실패 ▶ %', msg; end if;
end $$;

-- ══════════════ 시험 ══════════════
do $$
declare t record; n int; okay boolean;
begin
  select * into t from t_ids;

  -- 1) 로그인 안 한 상태에서는 아무것도 안 보여야 합니다
  perform set_config('request.jwt.claims', null, true);
  perform set_config('role', 'anon', true);
  select count(*) into n from public.customers;
  perform pg_temp.expect(n = 0, '로그인하지 않았는데 고객이 보입니다 (' || n || '건)');

  -- 2) A사 영업1: 자기 담당 2건만 (B사 것은 안 보임)
  perform pg_temp.act_as(t.u1);
  select count(*) into n from public.customers;
  perform pg_temp.expect(n = 2, 'A사 영업1에게 2건이 보여야 하는데 ' || n || '건입니다');
  select count(*) into n from public.customers where company_id = t.cb;
  perform pg_temp.expect(n = 0, 'A사 영업1에게 B사 고객이 보입니다');

  -- 3) A사 영업2: 공유받은 1건만
  perform pg_temp.act_as(t.u2);
  select count(*) into n from public.customers;
  perform pg_temp.expect(n = 1, 'A사 영업2에게 공유받은 1건만 보여야 하는데 ' || n || '건입니다');
  select count(*) into n from public.customers where id = t.k1;
  perform pg_temp.expect(n = 0, '공유받지 않은 고객이 영업2에게 보입니다');

  -- 4) A사 관리자: 회사 전체 2건 (B사는 여전히 안 보임)
  perform pg_temp.act_as(t.ua);
  select count(*) into n from public.customers;
  perform pg_temp.expect(n = 2, 'A사 관리자에게 2건이 보여야 하는데 ' || n || '건입니다');
  select count(*) into n from public.customers where company_id = t.cb;
  perform pg_temp.expect(n = 0, 'A사 관리자에게 B사 고객이 보입니다');

  -- 5) B사 영업: 자기 회사 1건만
  perform pg_temp.act_as(t.ub);
  select count(*) into n from public.customers;
  perform pg_temp.expect(n = 1, 'B사 영업에게 1건만 보여야 하는데 ' || n || '건입니다');

  -- 6) 남의 회사 고객을 고치려 해도 아무 일도 일어나지 않아야 합니다
  perform pg_temp.act_as(t.ub);
  update public.customers set name = '탈취' where id = t.k1;
  get diagnostics n = row_count;
  perform pg_temp.expect(n = 0, 'B사 사용자가 A사 고객을 고쳤습니다');

  -- 7) 남의 회사로 고객을 밀어 넣을 수 없어야 합니다
  perform pg_temp.act_as(t.ub);
  okay := false;
  begin
    insert into public.customers(company_id, owner_id, name)
      values (t.ca, t.ub, '침입');
  exception when others then okay := true;
  end;
  perform pg_temp.expect(okay, 'B사 사용자가 A사에 고객을 만들었습니다');

  -- 8) 자기 회사 안이라도 남을 담당자로 지정할 수 없어야 합니다 (일반 사용자)
  perform pg_temp.act_as(t.u2);
  okay := false;
  begin
    insert into public.customers(company_id, owner_id, name)
      values (t.ca, t.u1, '남의것');
  exception when others then okay := true;
  end;
  perform pg_temp.expect(okay, '일반 사용자가 남을 담당자로 지정했습니다');

  -- 9) 타임라인도 같은 규칙을 따라야 합니다
  perform pg_temp.act_as(t.u2);
  select count(*) into n from public.activities;
  perform pg_temp.expect(n = 1, 'A사 영업2에게 기록 1건만 보여야 하는데 ' || n || '건입니다');
  perform pg_temp.act_as(t.ub);
  select count(*) into n from public.activities where company_id = t.ca;
  perform pg_temp.expect(n = 0, 'B사 사용자에게 A사 기록이 보입니다');

  -- 10) 프로필: 같은 회사 사람만 보이고, 권한은 스스로 못 올립니다
  perform pg_temp.act_as(t.u1);
  select count(*) into n from public.profiles;
  perform pg_temp.expect(n = 3, 'A사 사람 3명이 보여야 하는데 ' || n || '명입니다');
  update public.profiles set role = 'admin' where id = t.u1;
  get diagnostics n = row_count;
  perform pg_temp.expect(n = 0, '일반 사용자가 스스로 관리자가 되었습니다');

  -- 11) 다른 회사 사람은 아예 안 보여야 합니다
  perform pg_temp.act_as(t.ub);
  select count(*) into n from public.profiles where company_id = t.ca;
  perform pg_temp.expect(n = 0, 'B사 사용자에게 A사 직원이 보입니다');

  -- 12) 감사 기록은 관리자만
  perform pg_temp.act_as(t.u1);
  select count(*) into n from public.audit_log;
  perform pg_temp.expect(n = 0, '일반 사용자가 감사 기록을 봅니다');

  perform set_config('role', 'postgres', true);
  raise notice '───────────────────────────';
  raise notice '  모든 시험 통과 (12/12)';
  raise notice '───────────────────────────';
end $$;

rollback;
