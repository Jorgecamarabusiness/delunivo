-- All invitation mutations go through narrow RPCs. This prevents a co-admin
-- from bypassing owner-only admin invitations through the Data API.

alter function public.create_invitation_with_courses(
  uuid, text, text, text, timestamptz, text, uuid[]
) security definer;

revoke insert, update, delete, truncate, references, trigger
  on table public.invitations from anon, authenticated;

drop policy if exists invitations_admin_insert on public.invitations;
drop policy if exists invitations_admin_update on public.invitations;

revoke insert, delete on table public.invitation_courses from authenticated;
drop policy if exists invitation_courses_admin_insert on public.invitation_courses;
drop policy if exists invitation_courses_admin_delete on public.invitation_courses;

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

-- Students can hold a grant for a draft course, but its content only becomes
-- readable when the course and each lesson are published. Admins keep draft
-- access through the first branch and the separate management policy.
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
        course.status = 'published'
        and public.is_org_student(course.organization_id)
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

drop policy if exists lessons_course_access_read on public.lessons;
create policy lessons_course_access_read
on public.lessons
for select
to authenticated
using (status = 'published' and public.has_course_access(course_id));
