-- Keep public images separate from private lesson videos. All writes use the
-- service role after application-level tenant authorization; only reads are
-- public, and every object path starts with the owning organization id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- `handle_new_user` is a trigger function, not a browser RPC. The trigger
-- continues to execute as its owner after these grants are removed.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- Deprecated single-tenant helper: retain it for rollback compatibility while
-- making it unavailable through the Data API.
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to service_role;

-- Profiles are created by the auth trigger and are not edited directly by the
-- browser. Row ownership alone must never allow changing role columns.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- Server-only codes should be closed by grants as well as by RLS.
revoke all on table public.verification_codes from anon, authenticated;
grant select, insert, update, delete on table public.verification_codes
  to service_role;

create unique index if not exists verification_codes_one_active_idx
  on public.verification_codes (lower(email), purpose)
  where consumed_at is null;

-- New objects start closed. Migrations must opt browser roles into only the
-- operations they actually need instead of inheriting blanket privileges.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- Issue codes and enforce both rate limits in one transaction. The advisory
-- lock serializes issuers so parallel requests cannot all pass the counts.
create or replace function public.issue_verification_code(
  p_email text,
  p_code_hash text,
  p_purpose text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(p_email));
  window_start timestamptz := now() - interval '15 minutes';
  per_email_count integer;
  global_count integer;
begin
  if normalized_email = ''
     or p_purpose not in ('signup', 'password_reset')
     or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid verification code input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('verification_codes:issue', 0));

  select count(*) into per_email_count
  from public.verification_codes
  where lower(email) = normalized_email
    and created_at >= window_start;

  if per_email_count >= 3 then
    return 'rate_limited_email';
  end if;

  select count(*) into global_count
  from public.verification_codes
  where created_at >= window_start;

  if global_count >= 60 then
    return 'rate_limited_global';
  end if;

  update public.verification_codes
  set consumed_at = now()
  where lower(email) = normalized_email
    and purpose = p_purpose
    and consumed_at is null;

  insert into public.verification_codes (
    email,
    code_hash,
    purpose,
    expires_at
  ) values (
    normalized_email,
    p_code_hash,
    p_purpose,
    now() + interval '30 minutes'
  );

  return 'issued';
end;
$$;

revoke all on function public.issue_verification_code(text, text, text)
  from public, anon, authenticated;
grant execute on function public.issue_verification_code(text, text, text)
  to service_role;

-- Validate, increment attempts and consume a code while holding a row lock.
-- A JSON result keeps the public-facing messages in the application.
create or replace function public.consume_verification_code(
  p_email text,
  p_code_hash text,
  p_purpose text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(p_email));
  target public.verification_codes%rowtype;
  remaining_attempts integer;
begin
  if normalized_email = ''
     or p_purpose not in ('signup', 'password_reset')
     or p_code_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'missing');
  end if;

  select * into target
  from public.verification_codes
  where lower(email) = normalized_email
    and purpose = p_purpose
    and consumed_at is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  if target.expires_at < now() then
    update public.verification_codes
    set consumed_at = now()
    where id = target.id;
    return jsonb_build_object('status', 'expired');
  end if;

  if target.attempts >= 5 then
    update public.verification_codes
    set consumed_at = coalesce(consumed_at, now())
    where id = target.id;
    return jsonb_build_object('status', 'too_many_attempts');
  end if;

  if target.code_hash <> p_code_hash then
    remaining_attempts := 5 - (target.attempts + 1);
    update public.verification_codes
    set attempts = attempts + 1,
        consumed_at = case when remaining_attempts = 0 then now() else consumed_at end
    where id = target.id;
    return jsonb_build_object(
      'status', 'incorrect',
      'attempts_left', remaining_attempts
    );
  end if;

  update public.verification_codes
  set consumed_at = now()
  where id = target.id;

  return jsonb_build_object('status', 'consumed');
end;
$$;

revoke all on function public.consume_verification_code(text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_verification_code(text, text, text)
  to service_role;

-- Owning a user id is not enough to write arbitrary progress. The referenced
-- lesson must belong to a course the caller can currently access.
drop policy if exists "Users can insert own views" on public.video_views;
create policy video_views_owner_insert_with_access
on public.video_views
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lessons lesson
    where lesson.id = video_views.lesson_id
      and public.has_course_access(lesson.course_id)
  )
);

drop policy if exists video_views_owner_delete on public.video_views;
create policy video_views_owner_delete_with_access
on public.video_views
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.lessons lesson
    where lesson.id = video_views.lesson_id
      and public.has_course_access(lesson.course_id)
  )
);

-- Replace the single known broken logo with a same-origin asset shipped with
-- the application. This is safe to run before or after the bucket migration.
update public.organizations
set logo_url = '/ivan-organico-logo.svg'
where slug = 'ivanorganico'
  and logo_url like '%/object/public/lesson-media/%';

-- Hide the confirmed zero-sale test course from the real storefront without
-- deleting it or its authoring history.
update public.courses
set status = 'draft'
where id = 'e42c32b8-d44b-4311-acb8-e9df2c44065c'
  and title = 'test2'
  and status = 'published'
  and not exists (
    select 1 from public.purchases
    where course_id = 'e42c32b8-d44b-4311-acb8-e9df2c44065c'
  );
