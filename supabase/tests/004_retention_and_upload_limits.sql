begin;
select plan(5);
select ok(not has_function_privilege('authenticated','public.purge_expired_operational_data()','execute'),'browser cannot purge operational history');
do $$ declare actor uuid:='90000000-0000-4000-8000-000000000001'; org uuid:='90000000-0000-4000-8000-000000000002'; course uuid:='90000000-0000-4000-8000-000000000003'; lesson uuid:='90000000-0000-4000-8000-000000000004'; begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values(actor,'authenticated','authenticated','upload-limit@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(org,'Upload limits','upload-limits-synthetic',actor);
  insert into public.organization_admins(organization_id,user_id,role) values(org,actor,'owner');
  insert into public.courses(id,organization_id,title,description,price,status) values(course,org,'Upload','Synthetic',0,'published');
  insert into public.lessons(id,course_id,title,order_index) values(lesson,course,'Upload',0);
  for i in 1..3 loop
    insert into public.video_assets(organization_id,course_id,lesson_id,block_id,created_by,status,is_current,declared_size_bytes)
      values(org,course,lesson,gen_random_uuid(),actor,'waiting_for_upload',false,21474836480);
  end loop;
  begin
    insert into public.video_assets(organization_id,course_id,lesson_id,block_id,created_by,status,is_current,declared_size_bytes)
      values(org,course,lesson,gen_random_uuid(),actor,'waiting_for_upload',false,1);
    raise exception 'quota_bypassed';
  exception when others then if sqlerrm<>'upload_rate_limited' then raise; end if; end;
end $$;
select pass('changing block IDs cannot bypass three active uploads per actor');
select is((select count(*)::integer from public.video_assets where created_by='90000000-0000-4000-8000-000000000001'),3,'rejected reservation creates no fourth provider request');
insert into public.account_deletion_jobs(target_user_id,actor_user_id,administrative,reason,tracking_hash,status,stage,completed_at,audit_expires_at,tombstone_expires_at)
values('90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000011',true,'Synthetic audit reason',repeat('a',64),'completed','completed',now()-interval '2 years',now()-interval '1 year',now()+interval '4 years'),
('90000000-0000-4000-8000-000000000012',null,false,null,repeat('b',64),'completed','completed',now()-interval '7 years',now()-interval '6 years',now()-interval '1 year');
select public.purge_expired_operational_data();
select ok((select actor_user_id is null and reason is null from public.account_deletion_jobs where target_user_id='90000000-0000-4000-8000-000000000010'),'audit details expire while minimal tombstone remains');
select is((select count(*)::integer from public.account_deletion_jobs where target_user_id='90000000-0000-4000-8000-000000000012'),0,'completed tombstone expires after its justified period');
select * from finish();
rollback;
