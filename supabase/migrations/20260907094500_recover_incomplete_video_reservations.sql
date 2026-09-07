-- A reservation exists before the provider responds. Deleting that reservation
-- must not require an upload ID which has never been created.
alter table public.mux_deletion_jobs alter column mux_upload_id drop not null;
alter table public.mux_deletion_jobs add constraint mux_deletion_provider_reference
  check (mux_asset_id is not null or mux_upload_id is not null);

create or replace function public.queue_mux_video_deletion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.mux_asset_id is null and old.mux_upload_id is null then return old; end if;
  insert into public.mux_deletion_jobs(video_asset_id,mux_asset_id,mux_upload_id)
    values(old.id,old.mux_asset_id,old.mux_upload_id)
    on conflict(video_asset_id) do nothing;
  return old;
end;
$$;
revoke all on function public.queue_mux_video_deletion() from public,anon,authenticated;

-- Reclaim only rejected, unattached uploads. Published/current school material
-- is retained, including on identity deletion. The existing durable queue owns
-- provider deletion and retry; this function performs no external operation.
create or replace function public.queue_rejected_mux_assets()
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  insert into public.mux_deletion_jobs(video_asset_id,mux_asset_id,mux_upload_id)
    select v.id,v.mux_asset_id,v.mux_upload_id from public.video_assets v
    where v.status='errored' and not v.is_current
      and v.error_type in ('invalid_duration','video_track_missing','upload_url_missing','upload_registration_failed')
      and (v.mux_asset_id is not null or v.mux_upload_id is not null)
      and not exists (select 1 from public.lessons l,
        lateral jsonb_array_elements(coalesce(l.blocks,'[]'::jsonb)) b
        where b->>'mux_video_asset_id'=v.id::text)
    on conflict(video_asset_id) do nothing;
  get diagnostics affected=row_count;
  return affected;
end;
$$;
revoke all on function public.queue_rejected_mux_assets() from public,anon,authenticated;
grant execute on function public.queue_rejected_mux_assets() to service_role;
