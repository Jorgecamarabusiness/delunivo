-- Manual rollback for 20260830203510_course_scoped_invitations.sql.
-- WARNING: invited course grants and invitation notes are lost permanently.

drop policy if exists lessons_course_access_read on public.lessons;

create policy lessons_buyer_read
on public.lessons
for select
to authenticated
using (
  public.is_org_admin((
    select course.organization_id
    from public.courses course
    where course.id = lessons.course_id
  ))
  or exists (
    select 1
    from public.purchases purchase
    where purchase.course_id = lessons.course_id
      and purchase.user_id = auth.uid()
      and public.is_org_student(purchase.organization_id)
  )
);

drop function if exists public.has_course_access(uuid);
drop function if exists public.complete_invitation_acceptance(uuid, uuid);
drop function if exists public.create_invitation_with_courses(uuid, text, text, text, timestamptz, text, uuid[]);

drop table if exists public.student_course_access;
drop table if exists public.invitation_courses;

drop index if exists public.invitations_pending_unique_idx;
create unique index invitations_pending_unique_idx
  on public.invitations (organization_id, email, invite_type)
  where status = 'pending';

alter table public.invitations
  drop constraint if exists invitations_note_length_check;
alter table public.invitations
  drop column if exists note;
