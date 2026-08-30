-- Cover the nullable audit foreign keys so invitation/user deletion does not
-- require a full scan of all invited course grants.

create index if not exists student_course_access_invitation_id_idx
  on public.student_course_access(invitation_id);

create index if not exists student_course_access_granted_by_idx
  on public.student_course_access(granted_by);
