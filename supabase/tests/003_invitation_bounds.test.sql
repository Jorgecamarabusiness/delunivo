begin;
select plan(11);

select ok(not has_function_privilege('anon', 'public.complete_invitation_acceptance(uuid,uuid)', 'execute'), 'anon cannot accept invitations');
select ok(not has_function_privilege('authenticated', 'public.complete_invitation_acceptance(uuid,uuid)', 'execute'), 'authenticated cannot accept invitations directly');

do $$ begin
  begin
    insert into public.invitations(organization_id,email,invite_type,token_hash,expires_at)
      values('80000000-0000-4000-8000-000000000001','bounds@synthetic.invalid','student',repeat('a',64),now()+interval '8 days');
    raise exception 'long invitation accepted';
  exception when others then if sqlerrm <> 'invalid_invitation_expiration' then raise; end if; end;
end $$;
select pass('expiration beyond seven days is rejected');

do $$ begin
  begin
    insert into public.invitations(organization_id,email,invite_type,token_hash,expires_at)
      values('80000000-0000-4000-8000-000000000001','bounds@synthetic.invalid','student','not-a-hash',now()+interval '1 day');
    raise exception 'bad hash accepted';
  exception when others then if sqlerrm <> 'invalid_invitation_token_hash' then raise; end if; end;
end $$;
select pass('token hashes must be lowercase sha256 hex');

do $$ begin
  begin
    insert into public.invitations(organization_id,email,invite_type,token_hash,expires_at)
      values('80000000-0000-4000-8000-000000000001','invalid-email','student',repeat('a',64),now()+interval '1 day');
    raise exception 'bad email accepted';
  exception when others then if sqlerrm <> 'invalid_invitation_email' then raise; end if; end;
end $$;
select pass('invalid invitation email is rejected');

do $$ begin
  begin
    insert into public.invitations(organization_id,email,invite_type,token_hash,expires_at,note)
      values('80000000-0000-4000-8000-000000000001','note@synthetic.invalid','student',repeat('a',64),now()+interval '1 day',repeat('n',1001));
    raise exception 'long note accepted';
  exception when others then if sqlerrm <> 'invalid_invitation_note' then raise; end if; end;
end $$;
select pass('oversized invitation notes are rejected');

do $$
declare owner_id uuid := '80000000-0000-4000-8000-000000000010'; user_id uuid := '80000000-0000-4000-8000-000000000011'; org_id uuid := '80000000-0000-4000-8000-000000000012'; course_id uuid := '80000000-0000-4000-8000-000000000013'; invitation_id uuid := '80000000-0000-4000-8000-000000000014';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
    (owner_id,'authenticated','authenticated','bounds-owner@synthetic.invalid','x',now(),'{}','{}'),
    (user_id,'authenticated','authenticated','bounds-user@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(org_id,'Invitation bounds','invitation-bounds-sql',owner_id);
  insert into public.courses(id,organization_id,title,description,price,status) values(course_id,org_id,'Bounds course','Synthetic',0,'published');
  insert into public.invitations(id,organization_id,email,invite_type,token_hash,invited_by,expires_at)
    values(invitation_id,org_id,'bounds-user@synthetic.invalid','student',repeat('b',64),owner_id,now()+interval '1 day');
  insert into public.invitation_courses(invitation_id,course_id) values(invitation_id,course_id);
  insert into public.organization_students(organization_id,user_id,status,joined_via) values(org_id,user_id,'removed','invite');
  begin
    perform public.complete_invitation_acceptance(invitation_id,user_id);
    raise exception 'removed student restored';
  exception when others then if sqlerrm <> 'student_removed_requires_administrative_restoration' then raise; end if; end;
  if (select os.status from public.organization_students os where os.organization_id=org_id and os.user_id='80000000-0000-4000-8000-000000000011') <> 'removed' then raise exception 'removed roster changed'; end if;
  if (select status from public.invitations where id=invitation_id) <> 'pending' then raise exception 'invitation should remain pending'; end if;
end $$;
select pass('acceptance does not restore a removed roster row');

do $$
declare v_owner_id uuid := '80000000-0000-4000-8000-000000000030'; v_user_id uuid := '80000000-0000-4000-8000-000000000031'; v_org_id uuid := '80000000-0000-4000-8000-000000000032'; v_course_id uuid := '80000000-0000-4000-8000-000000000033'; v_invitation_id uuid := '80000000-0000-4000-8000-000000000034';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
    (v_owner_id,'authenticated','authenticated','bounds-owner-three@synthetic.invalid','x',now(),'{}','{}'),
    (v_user_id,'authenticated','authenticated','bounds-user-three@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(v_org_id,'Invitation revoked','invitation-revoked-sql',v_owner_id);
  insert into public.courses(id,organization_id,title,description,price,status) values(v_course_id,v_org_id,'Revoked course','Synthetic',0,'published');
  insert into public.invitations(id,organization_id,email,invite_type,token_hash,invited_by,expires_at)
    values(v_invitation_id,v_org_id,'bounds-user-three@synthetic.invalid','student',repeat('d',64),v_owner_id,now()+interval '1 day');
  insert into public.invitation_courses(invitation_id,course_id) values(v_invitation_id,v_course_id);
  insert into public.student_course_access(user_id,course_id,grant_source,revoked_at) values(v_user_id,v_course_id,'invite',now());
  begin
    perform public.complete_invitation_acceptance(v_invitation_id,v_user_id);
    raise exception 'revoked access restored';
  exception when others then if sqlerrm <> 'course_access_revoked_requires_administrative_restoration' then raise; end if; end;
  if (select a.revoked_at is null from public.student_course_access a where a.user_id=v_user_id and a.course_id=v_course_id) then raise exception 'revocation changed'; end if;
end $$;
select pass('acceptance does not restore a revoked course entitlement');

do $$
declare owner_id uuid := '80000000-0000-4000-8000-000000000020'; user_id uuid := '80000000-0000-4000-8000-000000000021'; org_id uuid := '80000000-0000-4000-8000-000000000022'; course_id uuid := '80000000-0000-4000-8000-000000000023'; invitation_id uuid := '80000000-0000-4000-8000-000000000024';
begin
  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
    (owner_id,'authenticated','authenticated','bounds-owner-two@synthetic.invalid','x',now(),'{}','{}'),
    (user_id,'authenticated','authenticated','bounds-user-two@synthetic.invalid','x',now(),'{}','{}');
  insert into public.organizations(id,name,slug,owner_id) values(org_id,'Invitation inactive','invitation-inactive-sql',owner_id);
  insert into public.courses(id,organization_id,title,description,price,status) values(course_id,org_id,'Inactive course','Synthetic',0,'published');
  insert into public.invitations(id,organization_id,email,invite_type,token_hash,invited_by,expires_at)
    values(invitation_id,org_id,'bounds-user-two@synthetic.invalid','student',repeat('c',64),owner_id,now()+interval '1 day');
  insert into public.invitation_courses(invitation_id,course_id) values(invitation_id,course_id);
  update public.profiles set account_status='deleting' where id=user_id;
  begin
    perform public.complete_invitation_acceptance(invitation_id,user_id);
    raise exception 'deleting account accepted invitation';
  exception when others then if sqlerrm <> 'account_inactive' then raise; end if; end;
end $$;
select pass('deleting identities cannot accept invitations');

select ok(exists(select 1 from pg_trigger where tgname='enforce_invitation_bounds' and tgrelid='public.invitations'::regclass), 'invitation bounds trigger is installed');
select ok(has_function_privilege('service_role', 'public.complete_invitation_acceptance(uuid,uuid)', 'execute'), 'service role retains acceptance contract');
select * from finish();
rollback;
