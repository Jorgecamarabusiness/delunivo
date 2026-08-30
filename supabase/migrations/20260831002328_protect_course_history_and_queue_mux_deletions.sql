-- Protect purchase history, enforce lesson/course consistency and make Mux
-- cleanup durable when courses, sections or lessons are deleted.

alter table public.purchases
  drop constraint purchases_course_id_fkey;

alter table public.purchases
  add constraint purchases_course_id_fkey
  foreign key (course_id) references public.courses(id) on delete restrict;

alter table public.sections
  add constraint sections_id_course_id_unique unique (id, course_id);

alter table public.lessons
  drop constraint lessons_section_id_fkey;

alter table public.lessons
  add constraint lessons_section_course_id_fkey
  foreign key (section_id, course_id)
  references public.sections(id, course_id)
  on delete cascade;

create table public.mux_deletion_jobs (
  id bigint generated always as identity primary key,
  video_asset_id uuid not null unique,
  mux_asset_id text,
  mux_upload_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index mux_deletion_jobs_pending_idx
  on public.mux_deletion_jobs (next_attempt_at, created_at)
  where status <> 'completed';

alter table public.mux_deletion_jobs enable row level security;
revoke all on table public.mux_deletion_jobs from public, anon, authenticated;
revoke all on sequence public.mux_deletion_jobs_id_seq from public, anon, authenticated;
grant all on table public.mux_deletion_jobs to service_role;
grant usage, select on sequence public.mux_deletion_jobs_id_seq to service_role;

create or replace function public.queue_mux_video_deletion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.mux_deletion_jobs (
    video_asset_id,
    mux_asset_id,
    mux_upload_id
  ) values (
    old.id,
    old.mux_asset_id,
    old.mux_upload_id
  )
  on conflict (video_asset_id) do nothing;

  return old;
end;
$$;

create trigger queue_mux_video_deletion_before_delete
before delete on public.video_assets
for each row execute function public.queue_mux_video_deletion();

create or replace function public.claim_mux_deletion_jobs(p_limit integer default 20)
returns setof public.mux_deletion_jobs
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.mux_deletion_jobs
  set status = 'processing',
      attempts = attempts + 1,
      updated_at = now()
  where id in (
    select id
    from public.mux_deletion_jobs
    where (
        status = 'pending'
        and next_attempt_at <= now()
      ) or (
        status = 'processing'
        and updated_at < now() - interval '15 minutes'
      )
    order by next_attempt_at, created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  returning *;
$$;

revoke all on function public.queue_mux_video_deletion() from public, anon, authenticated;
revoke all on function public.claim_mux_deletion_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_mux_deletion_jobs(integer) to service_role;
