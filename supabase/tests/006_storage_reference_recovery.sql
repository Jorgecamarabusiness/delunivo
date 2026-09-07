begin;
select plan(8);
select ok(private.storage_reference_matches('https://local.invalid/storage/v1/object/public/public-media/legacy%20image.png','public-media','legacy image.png'),'encoded school image matches exact storage object');
select ok(not private.storage_reference_matches('https://local.invalid/storage/v1/object/public/public-media/legacy%20image.png','lesson-media','legacy image.png'),'a reference cannot cross buckets');
select ok(not private.storage_reference_matches('https://local.invalid/storage/v1/object/public/public-media/a%ZZ.png','public-media','a.png'),'malformed escape does not match or abort cleanup');
select ok(not private.storage_reference_matches('a.png.backup','public-media','a.png'),'a partial substring never claims an object');
select ok(private.storage_reference_matches('https://local.invalid/storage/v1/object/sign/lesson-media/old%2Fvideo.mp4?token=synthetic','lesson-media','old/video.mp4'),'a signed encoded path matches independently of its expiring token');
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
  values('92000000-0000-4000-8000-000000000001','authenticated','authenticated','storage-reference@synthetic.invalid','x',now(),'{}','{}');
insert into public.organizations(id,name,slug,owner_id) values('92000000-0000-4000-8000-000000000002','Media reference','media-reference-synthetic','92000000-0000-4000-8000-000000000001');
insert into public.courses(id,organization_id,title,description,price) values('92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','Media','Synthetic',0);
insert into public.lessons(id,course_id,title,blocks) values('92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000003','Media',
  '[{"id":"text","type":"text","content":"<p><img alt=\"School image\" src=\"https://local.invalid/storage/v1/object/public/public-media/legacy%20image.png\"></p>"}]');
insert into storage.objects(bucket_id,name,owner,owner_id) values
  ('public-media','legacy image.png','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001'),
  ('public-media','unmatched-personal-file','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001');
insert into public.account_deletion_jobs(id,target_user_id,administrative,tracking_hash,status,stage,lease_token,lease_until,school_ids)
  values('92000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001',false,repeat('a',64),'processing','storage','92000000-0000-4000-8000-000000000006',now()+interval '5 minutes',array['92000000-0000-4000-8000-000000000002'::uuid]);
select is(public.detach_account_school_storage('92000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000006'),1,'rich-text school image is preserved while unmatched personal object remains for explicit review');
select ok((select owner is null and owner_id is null from storage.objects where bucket_id='public-media' and name='legacy image.png'),'school image survives without retaining the deleted uploader ownership');
select ok((select owner_id='92000000-0000-4000-8000-000000000001' from storage.objects where bucket_id='public-media' and name='unmatched-personal-file'),'unknown personal ownership is not silently converted to shared school media');
select * from finish();
rollback;
