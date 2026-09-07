begin;
select plan(7);

select ok(to_regclass('public.account_deletion_jobs') is not null, 'account lifecycle jobs exist');
select ok(not has_function_privilege('anon', 'public.begin_account_deletion(uuid,uuid,uuid,text,text,jsonb,uuid,text)', 'execute'), 'anon cannot begin deletion');
select ok(not has_function_privilege('authenticated', 'public.claim_account_deletion_job(uuid)', 'execute'), 'authenticated cannot claim deletion jobs');
select ok(not has_function_privilege('authenticated', 'public.complete_course_checkout(uuid,text,text,integer,text,text)', 'execute'), 'authenticated cannot settle checkout');
select ok(not has_function_privilege('authenticated', 'public.apply_course_payment_adjustment(text,text,integer,text,timestamptz)', 'execute'), 'authenticated cannot adjust payment history');

do $$
declare a uuid := '50000000-0000-4000-8000-000000000001'; b uuid := '50000000-0000-4000-8000-000000000002'; o uuid := '50000000-0000-4000-8000-000000000003';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
    (a,'authenticated','authenticated','lifecycle-owner-a@synthetic.invalid','x',now(),'{}','{}'),
    (b,'authenticated','authenticated','lifecycle-owner-b@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(o,'Lifecycle owner','lifecycle-owner-free-sql',a);
  insert into public.organization_admins(organization_id,user_id,role) values(o,a,'owner'),(o,b,'owner');
  update public.organizations set owner_id=b where id=o;
  delete from public.organization_admins where organization_id=o and user_id=a;
  delete from auth.users where id=a;
exception when others then
  raise exception 'a service-side successor must permit isolated Auth deletion: %', sqlerrm;
end $$;
select pass('owner succession permits Auth deletion without requiring a browser session');

do $$
declare s uuid := '50000000-0000-4000-8000-000000000004';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(s,'authenticated','authenticated','only-super-free@synthetic.invalid','x',now(),'{}','{}');
  update public.profiles set is_super_admin=true where id=s;
  begin
    update public.profiles set is_super_admin=false where id=s;
    raise exception 'last superadmin was removed';
  exception when others then
    if sqlerrm <> 'last_superadmin_requires_successor' then raise; end if;
  end;
end $$;
select pass('last superadmin trigger rejects direct service mutation');

select * from finish();
rollback;
