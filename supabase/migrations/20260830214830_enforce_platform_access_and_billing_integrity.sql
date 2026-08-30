-- Treat the commercial state as an authorization boundary, not just a UI gate.
-- Students keep reading purchased/invited courses; only organization management
-- writes are suspended when the company has no current Delunivo access.

create or replace function public.has_org_platform_access(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or (
      public.is_org_admin(org_id)
      and exists (
        select 1
        from public.organization_billing billing
        where billing.organization_id = org_id
          and (
            (
              billing.access_mode = 'complimentary'
              and (
                billing.access_expires_at is null
                or billing.access_expires_at > now()
              )
            )
            or (
              billing.access_mode = 'trial'
              and billing.access_expires_at > now()
            )
            or billing.platform_subscription_status in ('active', 'trialing', 'past_due')
          )
      )
    );
$$;

revoke all on function public.has_org_platform_access(uuid) from public, anon;
grant execute on function public.has_org_platform_access(uuid) to authenticated, service_role;

create unique index organization_billing_platform_customer_unique_idx
  on public.organization_billing (platform_stripe_customer_id)
  where platform_stripe_customer_id is not null;

create unique index organization_billing_platform_subscription_unique_idx
  on public.organization_billing (platform_subscription_id)
  where platform_subscription_id is not null;

-- Company admins need their status and visible commercial conditions, but not
-- internal superadmin notes or the Stripe coupon implementation identifier.
revoke select on table public.organization_billing from authenticated;
grant select (
  organization_id,
  platform_stripe_customer_id,
  platform_subscription_id,
  platform_subscription_status,
  access_mode,
  access_expires_at,
  discount_percent,
  discount_duration,
  updated_at
) on table public.organization_billing to authenticated;

drop policy if exists courses_admin_manage on public.courses;
create policy courses_admin_manage
on public.courses
for all
to authenticated
using (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
)
with check (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
);

drop policy if exists sections_admin_manage on public.sections;
create policy sections_admin_manage
on public.sections
for all
to authenticated
using (
  public.has_org_platform_access((
    select course.organization_id
    from public.courses course
    where course.id = sections.course_id
  ))
)
with check (
  public.has_org_platform_access((
    select course.organization_id
    from public.courses course
    where course.id = sections.course_id
  ))
);

drop policy if exists lessons_admin_manage on public.lessons;
create policy lessons_admin_manage
on public.lessons
for all
to authenticated
using (
  public.has_org_platform_access((
    select course.organization_id
    from public.courses course
    where course.id = lessons.course_id
  ))
)
with check (
  public.has_org_platform_access((
    select course.organization_id
    from public.courses course
    where course.id = lessons.course_id
  ))
);

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update
on public.organizations
for update
to authenticated
using (
  public.is_org_admin(id)
  and public.has_org_platform_access(id)
)
with check (
  public.is_org_admin(id)
  and public.has_org_platform_access(id)
);

drop policy if exists organization_admins_owner_insert on public.organization_admins;
create policy organization_admins_owner_insert
on public.organization_admins
for insert
to authenticated
with check (
  public.is_org_owner(organization_id)
  and public.has_org_platform_access(organization_id)
);

drop policy if exists organization_admins_owner_delete on public.organization_admins;
create policy organization_admins_owner_delete
on public.organization_admins
for delete
to authenticated
using (
  public.is_org_owner(organization_id)
  and public.has_org_platform_access(organization_id)
);

drop policy if exists organization_students_admin_insert on public.organization_students;
create policy organization_students_admin_insert
on public.organization_students
for insert
to authenticated
with check (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
);

drop policy if exists organization_students_admin_update on public.organization_students;
create policy organization_students_admin_update
on public.organization_students
for update
to authenticated
using (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
)
with check (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
);

drop policy if exists organization_integrations_owner_insert on public.organization_integrations;
create policy organization_integrations_owner_insert
on public.organization_integrations
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.is_org_owner(organization_id)
    and public.has_org_platform_access(organization_id)
  )
);

drop policy if exists organization_integrations_owner_update on public.organization_integrations;
create policy organization_integrations_owner_update
on public.organization_integrations
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_org_owner(organization_id)
    and public.has_org_platform_access(organization_id)
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_org_owner(organization_id)
    and public.has_org_platform_access(organization_id)
  )
);

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
security definer
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

  if not public.has_org_platform_access(p_organization_id) then
    raise exception 'Active platform access required';
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

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target
  from public.invitations
  where id = p_invitation_id
  for update;

  if target.id is null or target.status <> 'pending' then
    return false;
  end if;

  if not public.is_org_admin(target.organization_id) then
    raise exception 'Organization admin access required';
  end if;

  if not public.has_org_platform_access(target.organization_id) then
    raise exception 'Active platform access required';
  end if;

  if target.invite_type = 'admin'
     and not public.is_org_owner(target.organization_id) then
    raise exception 'Only the organization owner can revoke administrator invitations';
  end if;

  update public.invitations
  set status = 'revoked', revoked_by = auth.uid()
  where id = target.id;

  return true;
end;
$$;

revoke all on function public.revoke_invitation(uuid) from public, anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;
