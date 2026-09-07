-- Invitation links are short-lived credentials. Keep their shape and lifetime
-- valid at the database boundary even for service writers.
create or replace function private.enforce_invitation_bounds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  new.note := nullif(trim(new.note), '');

  if new.email is null
    or char_length(new.email) > 254
    or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_invitation_email';
  end if;
  if new.invite_type not in ('student', 'admin') then
    raise exception 'invalid_invitation_type';
  end if;
  if new.token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invitation_token_hash';
  end if;
  if new.expires_at is null or new.expires_at <= now() or new.expires_at > now() + interval '7 days' then
    raise exception 'invalid_invitation_expiration';
  end if;
  if new.note is not null and char_length(new.note) > 1000 then
    raise exception 'invalid_invitation_note';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_invitation_bounds() from public, anon, authenticated;

drop trigger if exists enforce_invitation_bounds on public.invitations;
create trigger enforce_invitation_bounds
before insert or update of email, invite_type, token_hash, expires_at, note
on public.invitations
for each row execute function private.enforce_invitation_bounds();

-- Keep the existing server-only contract. Acceptance is idempotent for valid,
-- active rows, but an invitation is never an implicit restoration mechanism.
create or replace function public.complete_invitation_acceptance(
  p_invitation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target public.invitations%rowtype;
  selected_course_count integer;
begin
  perform pg_advisory_xact_lock(742109,1);
  perform 1 from public.profiles where id=p_user_id for update;
  if not exists (select 1 from public.profiles where id = p_user_id and account_status = 'active')
    or exists (select 1 from public.account_deletion_jobs where target_user_id = p_user_id) then
    raise exception 'account_inactive';
  end if;

  select * into target from public.invitations where id = p_invitation_id for update;
  if target.id is null or target.status <> 'pending' then
    raise exception 'Invitation is not pending';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id and lower(email)=lower(target.email)) then
    raise exception 'invitation_identity_mismatch';
  end if;
  if target.expires_at <= now() then
    update public.invitations set status = 'expired' where id = target.id;
    raise exception 'Invitation has expired';
  end if;

  if target.invite_type = 'admin' then
    insert into public.organization_admins (organization_id, user_id, role, invited_by)
      values (target.organization_id, p_user_id, 'admin', target.invited_by)
    on conflict (organization_id, user_id) do update set invited_by = excluded.invited_by;
  else
    select count(*) into selected_course_count
    from public.invitation_courses invitation_course
    join public.courses course on course.id = invitation_course.course_id
    where invitation_course.invitation_id = target.id
      and course.organization_id = target.organization_id;
    if selected_course_count = 0 then raise exception 'Student invitation has no valid courses'; end if;

    if exists (
      select 1 from public.organization_students
      where organization_id = target.organization_id and user_id = p_user_id and status = 'removed'
      for update
    ) then
      raise exception 'student_removed_requires_administrative_restoration';
    end if;
    if exists (
      select 1 from public.student_course_access access
      join public.invitation_courses invitation_course on invitation_course.course_id = access.course_id
      where invitation_course.invitation_id = target.id
        and access.user_id = p_user_id and access.revoked_at is not null
      for update of access
    ) then
      raise exception 'course_access_revoked_requires_administrative_restoration';
    end if;

    insert into public.organization_students (organization_id, user_id, status, joined_via, invited_by, removed_at, removed_by, removed_reason)
      values (target.organization_id, p_user_id, 'active', 'invite', target.invited_by, null, null, null)
    on conflict (organization_id, user_id) do update set invited_by = excluded.invited_by;

    insert into public.student_course_access (user_id, course_id, invitation_id, granted_by)
    select p_user_id, invitation_course.course_id, target.id, target.invited_by
    from public.invitation_courses invitation_course
    join public.courses course on course.id = invitation_course.course_id
    where invitation_course.invitation_id = target.id
      and course.organization_id = target.organization_id
    on conflict (user_id, course_id) do update set
      invitation_id = excluded.invitation_id, granted_by = excluded.granted_by, created_at = now();
  end if;

  update public.invitations set status = 'accepted' where id = target.id;
end;
$$;

revoke all on function public.complete_invitation_acceptance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_invitation_acceptance(uuid, uuid) to service_role;
