-- Provider effects cannot share a Postgres transaction. Durable claims prevent
-- access restoration from racing a Storage removal already in flight.
alter table public.platform_storage_deletion_jobs drop constraint platform_storage_deletion_jobs_status_check;
alter table public.platform_storage_deletion_jobs add constraint platform_storage_deletion_jobs_status_check check(status in ('pending','processing','completed','retained','failed'));
alter table public.platform_storage_deletion_jobs add column claim_token uuid,add column lease_until timestamptz;

create or replace function public.claim_platform_storage_cleanup(p_job_id bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.platform_storage_deletion_jobs; b public.organization_billing; token uuid:=gen_random_uuid(); org uuid;
begin
 select organization_id into org from public.platform_storage_deletion_jobs where id=p_job_id;
 if org is null then return null; end if;
 select * into b from public.organization_billing where organization_id=org for update;
 select * into j from public.platform_storage_deletion_jobs where id=p_job_id for update;
 if j.status not in ('pending','failed','processing') or j.status='processing' and j.lease_until>now() then return null; end if;
 if b.retention_until is null or b.retention_until>now() or b.platform_subscription_status in ('active','trialing','past_due') or exists(select 1 from private.storage_school_references(j.bucket_id,j.object_name)) then
  update public.platform_storage_deletion_jobs set status='retained',claim_token=null,lease_until=null,last_error='access_restored_or_referenced' where id=j.id; return null;
 end if;
 update public.platform_storage_deletion_jobs set status='processing',claim_token=token,lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id;
 return jsonb_build_object('id',j.id,'token',token,'bucket',j.bucket_id,'name',j.object_name);
end $$;
revoke all on function public.claim_platform_storage_cleanup(bigint) from public,anon,authenticated;
grant execute on function public.claim_platform_storage_cleanup(bigint) to service_role;

create function private.prevent_restore_during_storage_cleanup() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (new.platform_subscription_status in ('active','trialing','past_due') or new.access_mode in ('trial','complimentary')) and
   (new.platform_subscription_status is distinct from old.platform_subscription_status or new.access_mode is distinct from old.access_mode or new.platform_subscription_id is distinct from old.platform_subscription_id or new.access_expires_at is distinct from old.access_expires_at) and
   exists(select 1 from public.platform_storage_deletion_jobs where organization_id=new.organization_id and status='processing') then raise exception 'storage_cleanup_in_progress_retry_payment_reconciliation'; end if;
 return new;
end $$;
revoke all on function private.prevent_restore_during_storage_cleanup() from public,anon,authenticated;
create trigger prevent_restore_during_storage_cleanup before update on public.organization_billing for each row execute function private.prevent_restore_during_storage_cleanup();

-- One API import per environment. A lease covers fetching and replacing an hour,
-- so an earlier response cannot overwrite a newer correction concurrently.
create table public.mux_import_workers(environment text primary key,claim_token uuid,lease_until timestamptz,history_cursor timestamptz,last_error text);
alter table public.mux_import_workers enable row level security;
revoke all on public.mux_import_workers from public,anon,authenticated;
grant all on public.mux_import_workers to service_role;
create function public.claim_mux_import(p_environment text,p_token uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.mux_import_workers(environment) values(p_environment) on conflict do nothing;
 update public.mux_import_workers set claim_token=p_token,lease_until=now()+interval '10 minutes' where environment=p_environment and (lease_until is null or lease_until<now());
 return found;
end $$;
revoke all on function public.claim_mux_import(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_mux_import(text,uuid) to service_role;

create function public.renew_mux_import(p_environment text,p_token uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.mux_import_workers set lease_until=now()+interval '10 minutes' where environment=p_environment and claim_token=p_token and lease_until>now();
 return found;
end $$;
revoke all on function public.renew_mux_import(text,uuid) from public,anon,authenticated;
grant execute on function public.renew_mux_import(text,uuid) to service_role;
create function public.replace_mux_usage_hour_leased(p_environment text,p_start timestamptz,p_rows jsonb,p_token uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; created numeric;
begin
 perform 1 from public.mux_import_workers where environment=p_environment and claim_token=p_token and lease_until>now() for update;
 if not found then raise exception 'mux_import_lease_lost'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  if r->>'passthrough' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   created:=case when r->>'created_at' ~ '^[0-9]+(\.[0-9]+)?$' then (r->>'created_at')::numeric else null end;
   update public.mux_asset_ledger set environment=p_environment,
    provider_created_at=coalesce(to_timestamp(created),provider_created_at),
    minimum_storage_until=coalesce(to_timestamp(created)+interval '720 hours',minimum_storage_until)
   where video_asset_id=(r->>'passthrough')::uuid and mux_asset_id=r->>'asset_id' and environment in (p_environment,'legacy-unverified');
  end if;
 end loop;
 perform public.replace_mux_usage_hour(p_environment,p_start,p_rows);
end $$;
revoke all on function public.replace_mux_usage_hour_leased(text,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.replace_mux_usage_hour_leased(text,timestamptz,jsonb,uuid) to service_role;

-- Include quota rejection in the existing persistent provider deletion queue.
create or replace function public.queue_rejected_mux_assets() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 insert into public.mux_deletion_jobs(video_asset_id,mux_asset_id,mux_upload_id)
 select v.id,v.mux_asset_id,v.mux_upload_id from public.video_assets v
 where v.status='errored' and not v.is_current and v.error_type in ('invalid_duration','video_track_missing','upload_url_missing','upload_registration_failed','library_capacity_exceeded','reservation_expired','provider_processing_failed')
 and (v.mux_asset_id is not null or v.mux_upload_id is not null)
 and not exists(select 1 from public.lessons l,lateral jsonb_array_elements(coalesce(l.blocks,'[]'::jsonb)) b where b->>'mux_video_asset_id'=v.id::text)
 on conflict(video_asset_id) do nothing;
 get diagnostics affected=row_count; return affected;
end $$;
revoke all on function public.queue_rejected_mux_assets() from public,anon,authenticated;
grant execute on function public.queue_rejected_mux_assets() to service_role;

create function public.record_platform_custom_request(p_user_id uuid,p_message text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.profiles where id=p_user_id and account_status='active' for update;
 if not found then raise exception 'active_identity_required'; end if;
 if length(trim(p_message)) not between 10 and 2000 then raise exception 'invalid_request'; end if;
 if exists(select 1 from public.platform_custom_requests where user_id=p_user_id and message=trim(p_message) and created_at>now()-interval '24 hours') then return; end if;
 if (select count(*) from public.platform_custom_requests where user_id=p_user_id and created_at>now()-interval '24 hours')>=3 then raise exception 'custom_request_rate_limit'; end if;
 insert into public.platform_custom_requests(user_id,message) values(p_user_id,trim(p_message));
end $$;
revoke all on function public.record_platform_custom_request(uuid,text) from public,anon,authenticated;
grant execute on function public.record_platform_custom_request(uuid,text) to service_role;

-- Snapshots repair missed terminal ready/error events. They never downgrade a webhook's
-- terminal state, including when it arrives between a REST read and this RPC.
create function public.recover_mux_asset_snapshot(p_transition jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.video_assets;
begin
 select * into v from public.video_assets where id=(p_transition->>'videoAssetId')::uuid for update;
 if v.id is null or v.status not in ('waiting_for_upload','processing') or p_transition->>'status' not in ('ready','errored') or (v.mux_asset_id is not null and v.mux_asset_id is distinct from p_transition->>'assetId') then return false; end if;
 perform public.apply_mux_video_event(v.id,p_transition->>'uploadId',p_transition->>'assetId',p_transition->>'playbackId',p_transition->>'status',(p_transition->>'eventCreatedAt')::timestamptz,(p_transition->>'durationSeconds')::numeric,p_transition->>'aspectRatio',p_transition->>'errorType',p_transition->>'errorMessage');
 return true;
end $$;
revoke all on function public.recover_mux_asset_snapshot(jsonb) from public,anon,authenticated;
grant execute on function public.recover_mux_asset_snapshot(jsonb) to service_role;
