begin;
select plan(5);
select ok(to_regclass('public.account_deletion_jobs') is not null, 'account lifecycle jobs exist');
select ok(not has_function_privilege('anon', 'public.begin_account_deletion(uuid,uuid,uuid,text,text,jsonb,uuid,text)', 'execute'), 'anon cannot begin deletion');
select ok(not has_function_privilege('authenticated', 'public.claim_account_deletion_job(uuid)', 'execute'), 'authenticated cannot claim deletion jobs');
do $$
declare a uuid:='30000000-0000-4000-8000-000000000001'; b uuid:='30000000-0000-4000-8000-000000000002'; o uuid:='30000000-0000-4000-8000-000000000003';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
    (a,'authenticated','authenticated','owner-a@synthetic.invalid','x',now(),'{}','{}'),(b,'authenticated','authenticated','owner-b@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(o,'Lifecycle owner','lifecycle-owner-sql',a);
  insert into public.organization_admins(organization_id,user_id,role) values(o,a,'owner');
  insert into public.organization_admins(organization_id,user_id,role) values(o,b,'admin');
  update public.organization_admins set role='owner' where organization_id=o and user_id=b;
  update public.organizations set owner_id=b where id=o;
  delete from public.organization_admins where organization_id=o and user_id=a;
exception when others then raise exception 'active successor without a session must be transferable: %',sqlerrm;
end $$;
select pass('an active successor without a browser session can receive school ownership');
do $$
declare s uuid:='30000000-0000-4000-8000-000000000004';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(s,'authenticated','authenticated','only-super@synthetic.invalid','x',now(),'{}','{}');
  update public.profiles set is_super_admin=true where id=s;
  begin update public.profiles set is_super_admin=false where id=s; raise exception 'last superadmin was removed'; exception when others then if sqlerrm<>'last_superadmin_requires_successor' then raise; end if; end;
end $$;
select pass('last superadmin trigger rejects direct service mutation');
select * from finish();
rollback;
