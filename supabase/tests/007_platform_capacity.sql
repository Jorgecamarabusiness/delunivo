begin;
select plan(15);
select ok(not has_table_privilege('authenticated','public.platform_delivery_packs','select'),'packs are private');
select ok(not has_function_privilege('authenticated','public.replace_mux_usage_hour(text,timestamptz,jsonb)','execute'),'browser cannot import usage');
select ok(not has_function_privilege('anon','public.admit_platform_playback(uuid,uuid,uuid,uuid,integer)','execute'),'browser cannot bypass playback permissions');
do $$ declare actor uuid:='91000000-0000-4000-8000-000000000001'; org uuid:='91000000-0000-4000-8000-000000000002'; course uuid:='91000000-0000-4000-8000-000000000003'; lesson uuid:='91000000-0000-4000-8000-000000000004'; begin
 insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(actor,'authenticated','authenticated','capacity@synthetic.invalid','x',now(),'{}','{}');
 insert into public.organizations(id,name,slug,owner_id) values(org,'Capacity synthetic','capacity-synthetic',actor);
 insert into public.organization_admins(organization_id,user_id,role) values(org,actor,'owner');
 insert into public.organization_billing(organization_id,access_mode,platform_subscription_status) values(org,'standard','canceled');
 insert into public.courses(id,organization_id,title,description,price,status) values(course,org,'Capacity','Synthetic',0,'published');
 insert into public.lessons(id,course_id,title,order_index) values(lesson,course,'Capacity',0);
end $$;
select ok(public.start_platform_trial('91000000-0000-4000-8000-000000000002','{"version":"2026-10-01","planKey":"trial"}'),'new school gets one manual trial');
select ok(not public.start_platform_trial('91000000-0000-4000-8000-000000000002','{}'),'trial cannot reset');
select is((select grace_seconds::integer from public.platform_capacity_cycles where organization_id='91000000-0000-4000-8000-000000000002'),0,'trial has no grace');
update public.organization_billing set quota_mode='enforce' where organization_id='91000000-0000-4000-8000-000000000002';
insert into public.video_assets(id,organization_id,course_id,lesson_id,block_id,created_by,reserved_duration_seconds,mux_environment,status)
 values('91000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000004',gen_random_uuid(),'91000000-0000-4000-8000-000000000001',5000,'test','waiting_for_upload');
select throws_ok($$insert into public.video_assets(organization_id,course_id,lesson_id,block_id,created_by,reserved_duration_seconds,status) values('91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000004',gen_random_uuid(),'91000000-0000-4000-8000-000000000001',5000,'waiting_for_upload')$$,'P0001','library_capacity_exceeded','second reservation cannot spend the same capacity');
update public.video_assets set mux_asset_id='synthetic-capacity',duration_seconds=7500,status='ready' where id='91000000-0000-4000-8000-000000000005';
select is((select status from public.video_assets where id='91000000-0000-4000-8000-000000000005'),'errored','false metadata cannot publish the asset');
select is((select duration_seconds::integer from public.mux_asset_ledger where video_asset_id='91000000-0000-4000-8000-000000000005'),7500,'rejected duration still counts supplier exposure');
delete from public.video_assets where id='91000000-0000-4000-8000-000000000005';
select is((select organization_id::text from public.mux_asset_ledger where mux_asset_id='synthetic-capacity'),'91000000-0000-4000-8000-000000000002','deleted asset retains school attribution');
update public.mux_deletion_jobs set status='completed',completed_at=now() where video_asset_id='91000000-0000-4000-8000-000000000005';
select is((public.platform_library_usage('91000000-0000-4000-8000-000000000002')->>'committed_seconds')::numeric::integer,7500,'provider deletion preserves minimum storage commitment');
-- Hourly aggregates assigned to the start instant, UTC [start,end).
update public.platform_capacity_cycles set starts_at=date_trunc('hour',now())-interval '24 hours',ends_at=date_trunc('hour',now())+interval '24 hours',base_seconds=10,grace_seconds=2 where organization_id='91000000-0000-4000-8000-000000000002';
insert into public.platform_delivery_packs(organization_id,source_id,starts_at,expires_at,granted_seconds,paid_cents,offer_snapshot)
 values('91000000-0000-4000-8000-000000000002','synthetic-paid-pack',now()-interval '24 hours',now()+interval '90 days',5,2000,'{}');
select public.replace_mux_usage_hour('test',date_trunc('hour',now())-interval '20 hours','[{"asset_id":"synthetic-capacity","delivered_seconds":18,"delivered_seconds_by_resolution":{"tier_1080p":18}},{"asset_id":"unattributed","delivered_seconds":2}]');
select is((select excess_seconds::integer from public.platform_capacity_cycles where organization_id='91000000-0000-4000-8000-000000000002'),1,'base then pack then single grace leaves explicit excess');
select public.replace_mux_usage_hour('test',date_trunc('hour',now())-interval '20 hours','[{"asset_id":"synthetic-capacity","delivered_seconds":11,"delivered_seconds_by_resolution":{"tier_1080p":11}}]');
select is((select used_seconds::integer from public.platform_delivery_packs where source_id='synthetic-paid-pack'),1,'late correction rebuilds pack use without drift');
select public.replace_mux_usage_hour('test',date_trunc('hour',now())-interval '20 hours','[{"asset_id":"synthetic-capacity","delivered_seconds":11,"delivered_seconds_by_resolution":{"tier_1080p":11}}]');
select is((select used_seconds::integer from public.platform_delivery_packs where source_id='synthetic-paid-pack'),1,'repeated import is idempotent');
select ok((public.admit_platform_playback('91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000099',900)->>'allowed')::boolean=false,'arbitrary session id is not an existing session');
select * from finish();
rollback;
