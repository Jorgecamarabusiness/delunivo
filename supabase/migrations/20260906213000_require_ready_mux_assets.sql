-- PREPARED ONLY: not applied to any external database.
-- Validate against the reconstructed isolated baseline before deployment.
-- The conditional UPDATE locks the row and verifies provider metadata atomically.

begin;

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
        and status = 'ready'
        and duration_seconds > 0
        and duration_seconds <= 43200
        and nullif(mux_playback_id, '') is not null;

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

revoke all on function public.update_lesson_blocks_with_mux_assets(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_lesson_blocks_with_mux_assets(uuid, jsonb) to service_role;

commit;
