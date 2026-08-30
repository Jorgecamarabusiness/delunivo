-- Manual rollback for 20260830185317_mux_video_vertical_slice.sql.
-- WARNING: this removes all Mux asset metadata and webhook history.
-- Run only after the application no longer references mux_video_asset_id.

drop function if exists public.apply_mux_video_event(uuid, text, text, text, text, timestamptz, numeric, text, text, text);
drop function if exists public.claim_mux_webhook_event(text, text, jsonb, timestamptz);
drop function if exists public.update_lesson_blocks_with_mux_assets(uuid, jsonb);
drop function if exists public.register_mux_direct_upload(uuid, uuid, uuid, uuid, uuid, uuid, text);

drop trigger if exists touch_mux_webhook_events_before_update on public.mux_webhook_events;
drop trigger if exists touch_video_assets_before_update on public.video_assets;
drop trigger if exists validate_video_asset_scope_before_write on public.video_assets;

drop function if exists public.touch_mux_video_row();
drop function if exists public.validate_video_asset_scope();

drop table if exists public.mux_webhook_events;
drop table if exists public.video_assets;
