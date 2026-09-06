begin;

select plan(8);

select ok(to_regclass('public.profiles') is not null, 'reconstructed baseline creates profiles');
select ok(to_regclass('public.video_assets') is not null, 'reconstructed baseline creates Mux assets');
select ok(to_regprocedure('public.issue_verification_code(text,text,text)') is not null, 'atomic OTP issuer exists');
select ok(to_regprocedure('public.consume_verification_code(text,text,text)') is not null, 'atomic OTP consumer exists');
select ok(to_regprocedure('public.update_lesson_blocks_with_mux_assets(uuid,jsonb)') is not null, 'ready-only Mux transaction exists');
select is(
  (select count(*) from public.admin_emails where email = 'backup-restore@synthetic.invalid'),
  1::bigint,
  'synthetic backup fixture was restored after migration reset'
);

do $$
declare
  owner_a uuid := '00000000-0000-0000-0000-000000000101';
  owner_b uuid := '00000000-0000-0000-0000-000000000102';
  org_a uuid := '00000000-0000-0000-0000-000000000201';
  org_b uuid := '00000000-0000-0000-0000-000000000202';
  course_a uuid := '00000000-0000-0000-0000-000000000301';
  course_b uuid := '00000000-0000-0000-0000-000000000302';
  changed_rows integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values
    (owner_a, 'authenticated', 'authenticated', 'rls-owner-a@synthetic.invalid', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}'),
    (owner_b, 'authenticated', 'authenticated', 'rls-owner-b@synthetic.invalid', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}');
  insert into public.organizations (id, name, slug, owner_id)
  values (org_a, 'Synthetic A', 'synthetic-a', owner_a), (org_b, 'Synthetic B', 'synthetic-b', owner_b);
  insert into public.organization_admins (organization_id, user_id, role)
  values (org_a, owner_a, 'owner'), (org_b, owner_b, 'owner');
  insert into public.organization_billing (organization_id, platform_subscription_status)
  values (org_a, 'active'), (org_b, 'active');
  insert into public.courses (id, organization_id, title, description, price, status)
  values
    (course_a, org_a, 'A', 'Synthetic course A', 10, 'published'),
    (course_b, org_b, 'B', 'Synthetic course B', 10, 'published');

  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.courses set title = 'cross-tenant mutation' where id = course_b;
  get diagnostics changed_rows = row_count;
  reset role;
  if changed_rows <> 0 then raise exception 'cross-tenant course update unexpectedly permitted'; end if;
end;
$$;
select pass('RLS rejects a cross-tenant course update for a real authenticated role');

do $$
declare
  owner_id uuid := '00000000-0000-0000-0000-000000000401';
  org_id uuid := '00000000-0000-0000-0000-000000000402';
  course_id uuid := '00000000-0000-0000-0000-000000000403';
  lesson_id uuid := '00000000-0000-0000-0000-000000000404';
  previous_asset uuid := '00000000-0000-0000-0000-000000000405';
  invalid_asset uuid := '00000000-0000-0000-0000-000000000406';
  valid_asset uuid := '00000000-0000-0000-0000-000000000407';
  previous_blocks jsonb := '[{"id":"00000000-0000-0000-0000-000000000405","type":"video_file","mux_video_asset_id":"00000000-0000-0000-0000-000000000405"}]';
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  values (owner_id, 'authenticated', 'authenticated', 'mux-owner@synthetic.invalid', 'not-used', now(), '{"provider":"email","providers":["email"]}', '{}');
  insert into public.organizations (id, name, slug, owner_id) values (org_id, 'Synthetic Mux', 'synthetic-mux', owner_id);
  insert into public.courses (id, organization_id, title, description, price) values (course_id, org_id, 'Mux', 'Synthetic Mux course', 10);
  insert into public.sections (course_id, title) values (course_id, 'Section');
  insert into public.lessons (id, course_id, title, blocks) values (lesson_id, course_id, 'Lesson', previous_blocks);
  insert into public.video_assets (id, organization_id, course_id, lesson_id, block_id, created_by, mux_upload_id, mux_asset_id, mux_playback_id, status, is_current, duration_seconds)
  values
    (previous_asset, org_id, course_id, lesson_id, previous_asset, owner_id, 'upload-previous', 'asset-previous', 'playback-previous', 'ready', true, 30),
    (invalid_asset, org_id, course_id, lesson_id, invalid_asset, owner_id, 'upload-invalid', 'asset-invalid', 'playback-invalid', 'ready', false, 0),
    (valid_asset, org_id, course_id, lesson_id, valid_asset, owner_id, 'upload-valid', 'asset-valid', 'playback-valid', 'ready', false, 90);
  begin
    perform public.update_lesson_blocks_with_mux_assets(
      lesson_id,
      jsonb_build_array(jsonb_build_object('id', invalid_asset, 'type', 'video_file', 'mux_video_asset_id', invalid_asset))
    );
    raise exception 'invalid Mux asset unexpectedly attached';
  exception when others then
    if sqlerrm <> 'Mux video asset is not attachable to this lesson block' then raise; end if;
  end;
  if not (select is_current from public.video_assets where id = previous_asset)
     or (select blocks from public.lessons where id = lesson_id) <> previous_blocks then
    raise exception 'failed Mux attachment did not roll back its changes';
  end if;
  perform public.update_lesson_blocks_with_mux_assets(
    lesson_id,
    jsonb_build_array(jsonb_build_object('id', valid_asset, 'type', 'video_file', 'mux_video_asset_id', valid_asset))
  );
  if not (select is_current from public.video_assets where id = valid_asset)
     or (select is_current from public.video_assets where id = previous_asset) then
    raise exception 'valid Mux attachment did not switch the current asset atomically';
  end if;
end;
$$;
select pass('ready-only Mux attachment rolls back invalid assets and promotes a valid asset atomically');

select * from finish();
rollback;
