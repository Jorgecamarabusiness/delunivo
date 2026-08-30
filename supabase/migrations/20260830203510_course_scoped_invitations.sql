-- One pending invitation per person, optional internal notes, and explicit
-- course grants for students invited outside the paid checkout flow.

alter table public.invitations
  add column if not exists note text;

alter table public.invitations
  drop constraint if exists invitations_note_length_check;

alter table public.invitations
  add constraint invitations_note_length_check
  check (note is null or char_length(note) <= 1000);

create table if not exists public.invitation_courses (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (invitation_id, course_id)
);

create index if not exists invitation_courses_course_id_idx
  on public.invitation_courses(course_id);

alter table public.invitation_courses enable row level security;

revoke all on table public.invitation_courses from public, anon;
grant select, insert, delete on table public.invitation_courses to authenticated;

drop policy if exists invitation_courses_admin_read on public.invitation_courses;
create policy invitation_courses_admin_read
on public.invitation_courses
for select
to authenticated
using (
  exists (
    select 1
    from public.invitations invitation
    where invitation.id = invitation_courses.invitation_id
      and public.is_org_admin(invitation.organization_id)
  )
);

drop policy if exists invitation_courses_admin_insert on public.invitation_courses;
create policy invitation_courses_admin_insert
on public.invitation_courses
for insert
to authenticated
with check (
  exists (
    select 1
    from public.invitations invitation
    join public.courses course
      on course.id = invitation_courses.course_id
     and course.organization_id = invitation.organization_id
    where invitation.id = invitation_courses.invitation_id
      and public.is_org_admin(invitation.organization_id)
  )
);

drop policy if exists invitation_courses_admin_delete on public.invitation_courses;
create policy invitation_courses_admin_delete
on public.invitation_courses
for delete
to authenticated
using (
  exists (
    select 1
    from public.invitations invitation
    where invitation.id = invitation_courses.invitation_id
      and public.is_org_admin(invitation.organization_id)
  )
);

create table if not exists public.student_course_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create index if not exists student_course_access_course_id_idx
  on public.student_course_access(course_id);

alter table public.student_course_access enable row level security;

revoke all on table public.student_course_access from public, anon;
grant select on table public.student_course_access to authenticated;

drop policy if exists student_course_access_read on public.student_course_access;
create policy student_course_access_read
on public.student_course_access
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_admin((
    select course.organization_id
    from public.courses course
    where course.id = student_course_access.course_id
  ))
);

-- Old student invitations meant "all courses". Preserve any still-valid link
-- when moving to explicit course selection.
insert into public.invitation_courses (invitation_id, course_id)
select invitation.id, course.id
from public.invitations invitation
join public.courses course
  on course.organization_id = invitation.organization_id
where invitation.invite_type = 'student'
  and invitation.status = 'pending'
  and invitation.expires_at > now()
on conflict do nothing;

-- Expired rows should not continue blocking a new unique invitation.
update public.invitations
set status = 'expired'
where status = 'pending'
  and expires_at <= now();

-- If historical data contains two active pending invitations for the same
-- person, keep the newest and revoke the rest before adding the stricter key.
with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, lower(email)
      order by created_at desc, id desc
    ) as position
  from public.invitations
  where status = 'pending'
)
update public.invitations invitation
set status = 'revoked'
from ranked
where invitation.id = ranked.id
  and ranked.position > 1;

drop index if exists public.invitations_pending_unique_idx;

create unique index invitations_pending_unique_idx
  on public.invitations (organization_id, lower(email))
  where status = 'pending';

create or replace function public.create_invitation_with_courses(
  p_organization_id uuid,
  p_email text,
  p_invite_type text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_note text,
  p_course_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  created_invitation_id uuid;
  requested_course_count integer;
  valid_course_count integer;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_org_admin(p_organization_id) then
    raise exception 'Organization admin access required';
  end if;

  if p_invite_type not in ('student', 'admin') then
    raise exception 'Invalid invitation type';
  end if;

  if p_invite_type = 'admin' and not public.is_org_owner(p_organization_id) then
    raise exception 'Only the organization owner can invite administrators';
  end if;

  if nullif(trim(lower(p_email)), '') is null then
    raise exception 'Invitation email is required';
  end if;

  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Invitation note is too long';
  end if;

  update public.invitations
  set status = 'expired'
  where organization_id = p_organization_id
    and lower(email) = lower(trim(p_email))
    and status = 'pending'
    and expires_at <= now();

  select count(*)
  into requested_course_count
  from (
    select distinct course_id
    from unnest(coalesce(p_course_ids, '{}'::uuid[])) as selected(course_id)
  ) requested;

  if p_invite_type = 'student' then
    if requested_course_count = 0 then
      raise exception 'Student invitations require at least one course';
    end if;

    select count(*)
    into valid_course_count
    from public.courses course
    where course.organization_id = p_organization_id
      and course.id = any(coalesce(p_course_ids, '{}'::uuid[]));

    if valid_course_count <> requested_course_count then
      raise exception 'One or more courses do not belong to the organization';
    end if;
  elsif requested_course_count <> 0 then
    raise exception 'Administrator invitations cannot include courses';
  end if;

  insert into public.invitations (
    organization_id,
    email,
    invite_type,
    token_hash,
    invited_by,
    expires_at,
    note
  ) values (
    p_organization_id,
    lower(trim(p_email)),
    p_invite_type,
    p_token_hash,
    actor_id,
    p_expires_at,
    nullif(trim(p_note), '')
  )
  returning id into created_invitation_id;

  if p_invite_type = 'student' then
    insert into public.invitation_courses (invitation_id, course_id)
    select created_invitation_id, selected.course_id
    from (
      select distinct course_id
      from unnest(p_course_ids) as requested(course_id)
    ) selected;
  end if;

  return created_invitation_id;
end;
$$;

revoke all on function public.create_invitation_with_courses(uuid, text, text, text, timestamptz, text, uuid[]) from public, anon;
grant execute on function public.create_invitation_with_courses(uuid, text, text, text, timestamptz, text, uuid[]) to authenticated;

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
  select *
  into target
  from public.invitations
  where id = p_invitation_id
  for update;

  if target.id is null or target.status <> 'pending' then
    raise exception 'Invitation is not pending';
  end if;

  if target.expires_at <= now() then
    update public.invitations set status = 'expired' where id = target.id;
    raise exception 'Invitation has expired';
  end if;

  if target.invite_type = 'admin' then
    insert into public.organization_admins (
      organization_id,
      user_id,
      role,
      invited_by
    ) values (
      target.organization_id,
      p_user_id,
      'admin',
      target.invited_by
    )
    on conflict (organization_id, user_id)
    do update set invited_by = excluded.invited_by;
  else
    select count(*)
    into selected_course_count
    from public.invitation_courses invitation_course
    join public.courses course on course.id = invitation_course.course_id
    where invitation_course.invitation_id = target.id
      and course.organization_id = target.organization_id;

    if selected_course_count = 0 then
      raise exception 'Student invitation has no valid courses';
    end if;

    insert into public.organization_students (
      organization_id,
      user_id,
      status,
      joined_via,
      invited_by,
      removed_at,
      removed_by,
      removed_reason
    ) values (
      target.organization_id,
      p_user_id,
      'active',
      'invite',
      target.invited_by,
      null,
      null,
      null
    )
    on conflict (organization_id, user_id)
    do update set
      status = 'active',
      invited_by = excluded.invited_by,
      removed_at = null,
      removed_by = null,
      removed_reason = null;

    insert into public.student_course_access (
      user_id,
      course_id,
      invitation_id,
      granted_by
    )
    select
      p_user_id,
      invitation_course.course_id,
      target.id,
      target.invited_by
    from public.invitation_courses invitation_course
    join public.courses course on course.id = invitation_course.course_id
    where invitation_course.invitation_id = target.id
      and course.organization_id = target.organization_id
    on conflict (user_id, course_id)
    do update set
      invitation_id = excluded.invitation_id,
      granted_by = excluded.granted_by,
      created_at = now();
  end if;

  update public.invitations
  set status = 'accepted'
  where id = target.id;
end;
$$;

revoke all on function public.complete_invitation_acceptance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_invitation_acceptance(uuid, uuid) to service_role;

create or replace function public.has_course_access(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select
      public.is_org_admin(course.organization_id)
      or (
        public.is_org_student(course.organization_id)
        and (
          exists (
            select 1
            from public.purchases purchase
            where purchase.course_id = course.id
              and purchase.user_id = auth.uid()
          )
          or exists (
            select 1
            from public.student_course_access access
            where access.course_id = course.id
              and access.user_id = auth.uid()
          )
        )
      )
    from public.courses course
    where course.id = target_course_id
  ), false);
$$;

revoke all on function public.has_course_access(uuid) from public, anon;
grant execute on function public.has_course_access(uuid) to authenticated, service_role;

drop policy if exists lessons_buyer_read on public.lessons;
drop policy if exists lessons_course_access_read on public.lessons;

create policy lessons_course_access_read
on public.lessons
for select
to authenticated
using (public.has_course_access(course_id));
