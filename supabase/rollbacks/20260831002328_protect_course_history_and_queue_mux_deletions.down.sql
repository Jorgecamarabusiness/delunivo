-- Manual rollback for 20260831002328_protect_course_history_and_queue_mux_deletions.sql.
-- WARNING: restoring ON DELETE CASCADE allows course deletion to erase purchases.

drop trigger if exists queue_mux_video_deletion_before_delete on public.video_assets;
drop function if exists public.queue_mux_video_deletion();
drop function if exists public.claim_mux_deletion_jobs(integer);
drop table if exists public.mux_deletion_jobs;

alter table public.lessons
  drop constraint if exists lessons_section_course_id_fkey;

alter table public.lessons
  add constraint lessons_section_id_fkey
  foreign key (section_id) references public.sections(id) on delete cascade;

alter table public.sections
  drop constraint if exists sections_id_course_id_unique;

alter table public.purchases
  drop constraint if exists purchases_course_id_fkey;

alter table public.purchases
  add constraint purchases_course_id_fkey
  foreign key (course_id) references public.courses(id) on delete cascade;
