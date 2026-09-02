-- Remove anonymous access to tenant membership helpers. Authenticated clients
-- intentionally retain EXECUTE because the application calls these RPCs and
-- RLS policies use them for authorization.
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.is_org_owner(uuid) from public, anon;
revoke execute on function public.is_org_student(uuid) from public, anon;

grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.is_org_admin(uuid) to authenticated, service_role;
grant execute on function public.is_org_owner(uuid) to authenticated, service_role;
grant execute on function public.is_org_student(uuid) to authenticated, service_role;

-- Keep one SELECT policy per table and split management policies by operation.
-- This preserves the same authorization rules without evaluating multiple
-- permissive policies for every row read.
drop policy if exists courses_admin_manage on public.courses;
create policy courses_admin_insert on public.courses
for insert to authenticated
with check (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
);
create policy courses_admin_update on public.courses
for update to authenticated
using (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
)
with check (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
);
create policy courses_admin_delete on public.courses
for delete to authenticated
using (
  public.is_org_admin(organization_id)
  and public.has_org_platform_access(organization_id)
);

drop policy if exists sections_admin_manage on public.sections;
create policy sections_admin_insert on public.sections
for insert to authenticated
with check (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = sections.course_id
  ))
);
create policy sections_admin_update on public.sections
for update to authenticated
using (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = sections.course_id
  ))
)
with check (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = sections.course_id
  ))
);
create policy sections_admin_delete on public.sections
for delete to authenticated
using (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = sections.course_id
  ))
);

drop policy if exists lessons_admin_manage on public.lessons;
create policy lessons_admin_insert on public.lessons
for insert to authenticated
with check (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = lessons.course_id
  ))
);
create policy lessons_admin_update on public.lessons
for update to authenticated
using (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = lessons.course_id
  ))
)
with check (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = lessons.course_id
  ))
);
create policy lessons_admin_delete on public.lessons
for delete to authenticated
using (
  public.has_org_platform_access((
    select course.organization_id from public.courses course
    where course.id = lessons.course_id
  ))
);

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy profiles_authenticated_read on public.profiles
for select to authenticated
using (
  (select auth.uid()) = id
  or public.is_super_admin()
  or exists (
    select 1 from public.organization_students student
    where student.user_id = profiles.id
      and public.is_org_admin(student.organization_id)
  )
  or exists (
    select 1 from public.organization_admins administrator
    where administrator.user_id = profiles.id
      and public.is_org_admin(administrator.organization_id)
  )
);

drop policy if exists "Users can view their own purchases" on public.purchases;
drop policy if exists purchases_org_admin_read on public.purchases;
create policy purchases_authenticated_read on public.purchases
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_org_admin(organization_id)
);

drop policy if exists "Users can view own views" on public.video_views;
drop policy if exists "Admins can view all views" on public.video_views;
create policy video_views_authenticated_read on public.video_views
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.lessons lesson
    join public.courses course on course.id = lesson.course_id
    where lesson.id = video_views.lesson_id
      and public.is_org_admin(course.organization_id)
  )
);

drop policy if exists video_views_owner_insert_with_access on public.video_views;
create policy video_views_owner_insert_with_access on public.video_views
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.lessons lesson
    where lesson.id = video_views.lesson_id
      and public.has_course_access(lesson.course_id)
  )
);

drop policy if exists video_views_owner_delete_with_access on public.video_views;
create policy video_views_owner_delete_with_access on public.video_views
for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.lessons lesson
    where lesson.id = video_views.lesson_id
      and public.has_course_access(lesson.course_id)
  )
);

drop policy if exists organization_students_read on public.organization_students;
create policy organization_students_read on public.organization_students
for select to authenticated
using (
  public.is_org_admin(organization_id)
  or user_id = (select auth.uid())
);

-- PostgreSQL does not automatically index the referencing side of foreign
-- keys. These indexes speed joins and avoid table scans during cascades.
create index if not exists invitations_invited_by_idx
  on public.invitations (invited_by);
create index if not exists invitations_revoked_by_idx
  on public.invitations (revoked_by);
create index if not exists lessons_course_id_idx
  on public.lessons (course_id);
create index if not exists lessons_section_course_id_idx
  on public.lessons (section_id, course_id);
create index if not exists organization_admins_invited_by_idx
  on public.organization_admins (invited_by);
create index if not exists organization_referral_codes_created_by_idx
  on public.organization_referral_codes (created_by);
create index if not exists organization_referrals_referral_code_id_idx
  on public.organization_referrals (referral_code_id);
create index if not exists organization_referrals_referrer_owner_id_idx
  on public.organization_referrals (referrer_owner_id);
create index if not exists organization_students_invited_by_idx
  on public.organization_students (invited_by);
create index if not exists organization_students_removed_by_idx
  on public.organization_students (removed_by);
create index if not exists organizations_featured_course_id_idx
  on public.organizations (featured_course_id);
create index if not exists organizations_owner_id_idx
  on public.organizations (owner_id);
create index if not exists platform_settings_updated_by_idx
  on public.platform_settings (updated_by);
create index if not exists purchases_course_id_idx
  on public.purchases (course_id);
create index if not exists sections_course_id_idx
  on public.sections (course_id);
create index if not exists support_impersonation_sessions_ended_by_idx
  on public.support_impersonation_sessions (ended_by);
create index if not exists video_assets_created_by_idx
  on public.video_assets (created_by);
create index if not exists video_views_lesson_id_idx
  on public.video_views (lesson_id);
