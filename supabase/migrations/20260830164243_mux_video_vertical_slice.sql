-- Mux video vertical slice.
-- This migration is intentionally additive and is not applied automatically.

create table public.video_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  block_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  mux_upload_id text not null unique,
  mux_asset_id text unique,
  mux_playback_id text unique,
  status text not null default 'waiting_for_upload'
    check (status in (
      'waiting_for_upload',
      'processing',
      'ready',
      'errored',
      'cancelled',
      'timed_out',
      'deleted'
    )),
  is_current boolean not null default false,
  duration_seconds numeric(12, 3),
  aspect_ratio text,
  error_type text,
  error_message text,
  last_mux_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_assets_mux_upload_id_not_blank check (length(trim(mux_upload_id)) > 0),
  constraint video_assets_ready_has_playback check (
    status <> 'ready' or (mux_asset_id is not null and mux_playback_id is not null)
  )
);

create unique index video_assets_one_current_per_block
  on public.video_assets (lesson_id, block_id)
  where is_current;

create index video_assets_organization_id_idx
  on public.video_assets (organization_id);

create index video_assets_course_id_idx
  on public.video_assets (course_id);

create index video_assets_lesson_id_idx
  on public.video_assets (lesson_id);

create index video_assets_status_idx
  on public.video_assets (status)
  where status in ('waiting_for_upload', 'processing');

create table public.mux_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  payload jsonb not null,
  last_error text,
  mux_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index mux_webhook_events_status_idx
  on public.mux_webhook_events (status, updated_at)
  where status <> 'completed';

alter table public.video_assets enable row level security;
alter table public.mux_webhook_events enable row level security;

-- These tables are deliberately server-only. The application performs explicit
-- authorization before using the service role. No anon/authenticated grants or
-- permissive RLS policies are created.
revoke all on table public.video_assets from public, anon, authenticated;
revoke all on table public.mux_webhook_events from public, anon, authenticated;
grant all on table public.video_assets to service_role;
grant all on table public.mux_webhook_events to service_role;

create or replace function public.validate_video_asset_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = new.lesson_id
      and c.id = new.course_id
      and c.organization_id = new.organization_id
  ) then
    raise exception 'Video asset scope does not match lesson, course and organization';
  end if;

  return new;
end;
$$;

create trigger validate_video_asset_scope_before_write
before insert or update of organization_id, course_id, lesson_id
on public.video_assets
for each row execute function public.validate_video_asset_scope();

create or replace function public.touch_mux_video_row()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_video_assets_before_update
before update on public.video_assets
for each row execute function public.touch_mux_video_row();

create trigger touch_mux_webhook_events_before_update
before update on public.mux_webhook_events
for each row execute function public.touch_mux_video_row();

create or replace function public.register_mux_direct_upload(
  p_video_asset_id uuid,
  p_organization_id uuid,
  p_course_id uuid,
  p_lesson_id uuid,
  p_block_id uuid,
  p_created_by uuid,
  p_mux_upload_id text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_mux_upload_id is null or length(trim(p_mux_upload_id)) = 0 then
    raise exception 'Mux upload id is required';
  end if;

  insert into public.video_assets (
    id,
    organization_id,
    course_id,
    lesson_id,
    block_id,
    created_by,
    mux_upload_id,
    status,
    is_current
  ) values (
    p_video_asset_id,
    p_organization_id,
    p_course_id,
    p_lesson_id,
    p_block_id,
    p_created_by,
    p_mux_upload_id,
    'waiting_for_upload',
    false
  );

  return p_video_asset_id;
end;
$$;

create or replace function public.update_lesson_blocks_with_mux_assets(
  p_lesson_id uuid,
  p_blocks jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  item_block_id uuid;
  item_video_asset_id uuid;
begin
  if jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'Lesson blocks must be a JSON array';
  end if;

  if not exists (select 1 from public.lessons where id = p_lesson_id) then
    raise exception 'Lesson not found';
  end if;

  -- A block becomes playable only in the same transaction that attaches it to
  -- the lesson. Replacements therefore do not break the currently saved video.
  update public.video_assets
  set is_current = false
  where lesson_id = p_lesson_id
    and is_current;

  for item in select value from jsonb_array_elements(p_blocks)
  loop
    if item->>'type' = 'video_file' and item ? 'mux_video_asset_id' then
      begin
        item_block_id := (item->>'id')::uuid;
        item_video_asset_id := (item->>'mux_video_asset_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Mux video block contains an invalid UUID';
      end;

      update public.video_assets
      set is_current = true
      where id = item_video_asset_id
        and lesson_id = p_lesson_id
        and block_id = item_block_id
        and status not in ('cancelled', 'timed_out', 'deleted');

      if not found then
        raise exception 'Mux video asset is not attachable to this lesson block';
      end if;
    end if;
  end loop;

  update public.lessons
  set blocks = p_blocks
  where id = p_lesson_id;

  if not found then
    raise exception 'Lesson not found';
  end if;
end;
$$;

create or replace function public.claim_mux_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_mux_created_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  existing_status text;
  existing_updated_at timestamptz;
begin
  insert into public.mux_webhook_events (
    event_id,
    event_type,
    status,
    attempts,
    payload,
    mux_created_at
  ) values (
    p_event_id,
    p_event_type,
    'processing',
    1,
    p_payload,
    p_mux_created_at
  )
  on conflict (event_id) do nothing;

  if found then
    return 'claimed';
  end if;

  select status, updated_at
  into existing_status, existing_updated_at
  from public.mux_webhook_events
  where event_id = p_event_id
  for update;

  if existing_status = 'completed' then
    return 'duplicate';
  end if;

  if existing_status = 'processing'
     and existing_updated_at > now() - interval '5 minutes' then
    return 'in_progress';
  end if;

  update public.mux_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      payload = p_payload,
      event_type = p_event_type,
      mux_created_at = p_mux_created_at,
      last_error = null,
      processed_at = null
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

create or replace function public.apply_mux_video_event(
  p_video_asset_id uuid,
  p_mux_upload_id text,
  p_mux_asset_id text,
  p_mux_playback_id text,
  p_status text,
  p_event_created_at timestamptz,
  p_duration_seconds numeric,
  p_aspect_ratio text,
  p_error_type text,
  p_error_message text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target public.video_assets%rowtype;
  should_advance boolean;
begin
  if p_status not in (
    'waiting_for_upload',
    'processing',
    'ready',
    'errored',
    'cancelled',
    'timed_out',
    'deleted'
  ) then
    raise exception 'Unsupported Mux video status: %', p_status;
  end if;

  select *
  into target
  from public.video_assets
  where (p_video_asset_id is not null and id = p_video_asset_id)
     or (p_mux_upload_id is not null and mux_upload_id = p_mux_upload_id)
     or (p_mux_asset_id is not null and mux_asset_id = p_mux_asset_id)
  order by
    case when p_video_asset_id is not null and id = p_video_asset_id then 0 else 1 end,
    created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No video asset matches the Mux event';
  end if;

  if p_video_asset_id is not null and target.id <> p_video_asset_id then
    raise exception 'Mux passthrough id conflicts with the stored association';
  end if;

  if p_mux_upload_id is not null and target.mux_upload_id <> p_mux_upload_id then
    raise exception 'Mux upload id conflicts with the stored association';
  end if;

  if target.mux_asset_id is not null
     and p_mux_asset_id is not null
     and target.mux_asset_id <> p_mux_asset_id then
    raise exception 'Mux asset id conflicts with the stored association';
  end if;

  should_advance := target.last_mux_event_at is null
    or p_event_created_at >= target.last_mux_event_at;

  update public.video_assets
  set mux_asset_id = coalesce(mux_asset_id, p_mux_asset_id),
      mux_playback_id = case
        when should_advance and p_mux_playback_id is not null then p_mux_playback_id
        else mux_playback_id
      end,
      status = case when should_advance then p_status else status end,
      duration_seconds = case
        when should_advance and p_duration_seconds is not null then p_duration_seconds
        else duration_seconds
      end,
      aspect_ratio = case
        when should_advance and p_aspect_ratio is not null then p_aspect_ratio
        else aspect_ratio
      end,
      error_type = case when should_advance then p_error_type else error_type end,
      error_message = case when should_advance then p_error_message else error_message end,
      last_mux_event_at = greatest(
        coalesce(last_mux_event_at, '-infinity'::timestamptz),
        p_event_created_at
      )
  where id = target.id;

  return target.id;
end;
$$;

revoke all on function public.validate_video_asset_scope() from public, anon, authenticated;
revoke all on function public.touch_mux_video_row() from public, anon, authenticated;
revoke all on function public.register_mux_direct_upload(uuid, uuid, uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.update_lesson_blocks_with_mux_assets(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_mux_webhook_event(text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.apply_mux_video_event(uuid, text, text, text, text, timestamptz, numeric, text, text, text) from public, anon, authenticated;

grant execute on function public.register_mux_direct_upload(uuid, uuid, uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.update_lesson_blocks_with_mux_assets(uuid, jsonb) to service_role;
grant execute on function public.claim_mux_webhook_event(text, text, jsonb, timestamptz) to service_role;
grant execute on function public.apply_mux_video_event(uuid, text, text, text, text, timestamptz, numeric, text, text, text) to service_role;
