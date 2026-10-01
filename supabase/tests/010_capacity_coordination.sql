begin;
select no_plan();
do $$ begin
 insert into auth.users(id,email,raw_user_meta_data) values('94000000-0000-4000-8000-000000000001','coordination@synthetic.invalid','{}');
 insert into public.organizations(id,name,slug,owner_id) values('94000000-0000-4000-8000-000000000002','Coordination synthetic','coordination-synthetic','94000000-0000-4000-8000-000000000001');
 insert into public.organization_billing(organization_id,platform_subscription_status,access_mode,retention_until) values('94000000-0000-4000-8000-000000000002','canceled','standard',now()-interval '1 day');
 insert into public.platform_storage_deletion_jobs(organization_id,bucket_id,object_name) values('94000000-0000-4000-8000-000000000002','public-media','coordination/orphan.png');
end $$;
select ok(not has_function_privilege('authenticated','public.claim_platform_storage_cleanup(bigint)','execute'),'Storage deletion claims are service only');
create temp table storage_claim as select public.claim_platform_storage_cleanup((select id from public.platform_storage_deletion_jobs where organization_id='94000000-0000-4000-8000-000000000002')) payload;
select ok((select payload is not null from storage_claim),'expired unreferenced object gets a durable claim');
select ok(public.claim_platform_storage_cleanup((select id from public.platform_storage_deletion_jobs where organization_id='94000000-0000-4000-8000-000000000002')) is null,'second worker cannot claim the same in-flight removal');
select throws_ok($$update public.organization_billing set platform_subscription_status='active' where organization_id='94000000-0000-4000-8000-000000000002'$$,'P0001','storage_cleanup_in_progress_retry_payment_reconciliation','restoration waits for the external effect already in flight');
update public.platform_storage_deletion_jobs set status='completed' where id=(select (payload->>'id')::bigint from storage_claim) and claim_token=(select (payload->>'token')::uuid from storage_claim);
select lives_ok($$update public.organization_billing set platform_subscription_status='active' where organization_id='94000000-0000-4000-8000-000000000002'$$,'restoration succeeds once provider removal is confirmed');
select ok(public.claim_mux_import('coordination-test','94000000-0000-4000-8000-000000000003'),'first importer owns environment lease');
select ok(not public.claim_mux_import('coordination-test','94000000-0000-4000-8000-000000000004'),'parallel importer cannot overtake correction');
select throws_ok($$select public.replace_mux_usage_hour_leased('coordination-test',date_trunc('hour',now()-interval '20 hours'),'[]','94000000-0000-4000-8000-000000000004')$$,'P0001','mux_import_lease_lost','wrong lease cannot change reliable coverage');
select lives_ok($$select public.replace_mux_usage_hour_leased('coordination-test',date_trunc('hour',now()-interval '20 hours'),'[]','94000000-0000-4000-8000-000000000003')$$,'correct lease imports a complete known-zero hour');
update public.mux_import_workers set lease_until=now()-interval '1 second' where environment='coordination-test';
select ok(not public.renew_mux_import('coordination-test','94000000-0000-4000-8000-000000000003'),'expired importer cannot renew its old claim');
select ok(public.claim_mux_import('coordination-test','94000000-0000-4000-8000-000000000004'),'another worker recovers an expired lease');
select throws_ok($$select public.replace_mux_usage_hour_leased('coordination-test',date_trunc('hour',now()-interval '20 hours'),'[]','94000000-0000-4000-8000-000000000003')$$,'P0001','mux_import_lease_lost','previously valid importer cannot alter attribution or coverage after takeover');
select public.record_platform_custom_request('94000000-0000-4000-8000-000000000001','Synthetic request one');
select public.record_platform_custom_request('94000000-0000-4000-8000-000000000001','Synthetic request one');
select is((select count(*)::integer from public.platform_custom_requests where user_id='94000000-0000-4000-8000-000000000001'),1,'repeated custom contact creates one request');
insert into public.platform_capacity_cycles(organization_id,starts_at,ends_at,rights_start_at,plan_key,offer_snapshot,base_seconds,grace_seconds) values('94000000-0000-4000-8000-000000000002',now()-interval '2 days',now()+interval '2 days',now()-interval '20 hours','inicio','{}',18000,0);
insert into public.mux_usage_hours(environment,mux_asset_id,starts_at,organization_id,delivered_seconds,resolution_seconds,provider_metadata) values
 ('coordination-test','before-payment',date_trunc('hour',now()-interval '30 hours'),'94000000-0000-4000-8000-000000000002',100,'{}','{}'),
 ('coordination-test','after-payment',date_trunc('hour',now()-interval '15 hours'),'94000000-0000-4000-8000-000000000002',200,'{}','{}');
select public.rebuild_platform_usage('94000000-0000-4000-8000-000000000002');
select is((select base_used_seconds::integer from public.platform_capacity_cycles where organization_id='94000000-0000-4000-8000-000000000002'),200,'usage before confirmed initial payment is not charged retroactively to the paid cycle');
insert into public.courses(id,organization_id,title,description,price,status) values('94000000-0000-4000-8000-000000000005','94000000-0000-4000-8000-000000000002','Snapshot synthetic','Synthetic',0,'published');
insert into public.lessons(id,course_id,title,order_index) values('94000000-0000-4000-8000-000000000006','94000000-0000-4000-8000-000000000005','Snapshot',0);
insert into public.video_assets(id,organization_id,course_id,lesson_id,block_id,created_by,mux_asset_id,mux_playback_id,status,duration_seconds,last_mux_event_at)
 values('94000000-0000-4000-8000-000000000007','94000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000005','94000000-0000-4000-8000-000000000006',gen_random_uuid(),'94000000-0000-4000-8000-000000000001','snapshot-synthetic','snapshot-playback','ready',60,now());
select ok(not public.recover_mux_asset_snapshot('{"videoAssetId":"94000000-0000-4000-8000-000000000007","assetId":"snapshot-synthetic","status":"processing"}'),'lagging snapshot cannot downgrade provider ready state');
select is((select status from public.video_assets where id='94000000-0000-4000-8000-000000000007'),'ready','signed ready video survives reconciliation');
insert into public.organizations(id,name,slug,owner_id,created_at) values('94000000-0000-4000-8000-000000000008','Pending trial','pending-trial-synthetic','94000000-0000-4000-8000-000000000001',now()-interval '2 hours');
insert into public.organization_billing(organization_id,platform_subscription_status,access_mode,pending_offer_at,pending_offer_snapshot,trial_initialization_status) values('94000000-0000-4000-8000-000000000008','canceled','standard',now()-interval '119 minutes','{"version":"2026-10-01","planKey":"trial"}','pending');
select ok(public.start_platform_trial('94000000-0000-4000-8000-000000000008','{"version":"2026-10-01","planKey":"trial"}'),'trial initialization retries after the original fifteen-minute creation window');
select is((select extract(epoch from(access_expires_at-now()))::integer from public.organization_billing where organization_id='94000000-0000-4000-8000-000000000008'),1202460,'retry retains the original trial start rather than resetting fourteen days');
select * from finish();
rollback;
