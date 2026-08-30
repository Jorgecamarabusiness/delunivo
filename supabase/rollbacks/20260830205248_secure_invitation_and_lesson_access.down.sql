drop policy if exists lessons_course_access_read on public.lessons;
create policy lessons_course_access_read
on public.lessons
for select
to authenticated
using (public.has_course_access(course_id));

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
            select 1 from public.purchases purchase
            where purchase.course_id = course.id
              and purchase.user_id = auth.uid()
          )
          or exists (
            select 1 from public.student_course_access access
            where access.course_id = course.id
              and access.user_id = auth.uid()
          )
        )
      )
    from public.courses course
    where course.id = target_course_id
  ), false);
$$;

drop function if exists public.revoke_invitation(uuid);

grant insert, update on table public.invitations to authenticated;
create policy invitations_admin_insert
on public.invitations for insert to authenticated
with check (public.is_org_admin(organization_id));
create policy invitations_admin_update
on public.invitations for update to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

grant insert, delete on table public.invitation_courses to authenticated;
create policy invitation_courses_admin_insert
on public.invitation_courses for insert to authenticated
with check (
  exists (
    select 1 from public.invitations invitation
    join public.courses course
      on course.id = invitation_courses.course_id
     and course.organization_id = invitation.organization_id
    where invitation.id = invitation_courses.invitation_id
      and public.is_org_admin(invitation.organization_id)
  )
);
create policy invitation_courses_admin_delete
on public.invitation_courses for delete to authenticated
using (
  exists (
    select 1 from public.invitations invitation
    where invitation.id = invitation_courses.invitation_id
      and public.is_org_admin(invitation.organization_id)
  )
);

alter function public.create_invitation_with_courses(
  uuid, text, text, text, timestamptz, text, uuid[]
) security invoker;
