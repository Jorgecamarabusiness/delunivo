-- Compatible operational controls. Historical rows are not rewritten at rollout.
create or replace function public.purge_expired_operational_data()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from private.account_action_limits where window_start < now() - interval '1 day';
  delete from public.verification_codes where expires_at < now() - interval '1 day';
  update public.support_impersonation_sessions set encrypted_actor_session='',ip_address=null,user_agent=null
    where expires_at < now() and (encrypted_actor_session<>'' or ip_address is not null or user_agent is not null);
  delete from public.support_impersonation_sessions where expires_at < now() - interval '1 year';
  update public.account_deletion_jobs set actor_user_id=null,reason=null,school_ids='{}',last_error_code=null
    where status='completed' and audit_expires_at<now();
  -- Keep commercial receipts, but stop retaining a deleted identity after six years.
  update public.purchases p set historical_user_id=null where p.user_id is null and exists(
    select 1 from public.account_deletion_jobs j where j.target_user_id=p.historical_user_id
      and j.status='completed' and j.tombstone_expires_at<now());
  update public.stripe_checkout_attempts a set historical_user_id=null where a.user_id is null and exists(
    select 1 from public.account_deletion_jobs j where j.target_user_id=a.historical_user_id
      and j.status='completed' and j.tombstone_expires_at<now());
  delete from public.account_deletion_jobs where status='completed' and tombstone_expires_at<now();
  update public.stripe_checkout_attempts set stripe_params='{}',stripe_session_url=null,error_message=null
    where status in ('completed','expired','failed') and updated_at < now() - interval '90 days'
      and (stripe_params<>'{}'::jsonb or stripe_session_url is not null or error_message is not null);
  update public.mux_webhook_events set payload='{}',last_error=null
    where status='completed' and received_at < now() - interval '30 days' and payload<>'{}'::jsonb;
end;
$$;
revoke all on function public.purge_expired_operational_data() from public,anon,authenticated;
grant execute on function public.purge_expired_operational_data() to service_role;

-- Reserve capacity before asking Mux for a URL. Locks prevent ID-hopping races.
alter table public.video_assets alter column mux_upload_id drop not null;
alter table public.video_assets add column declared_size_bytes bigint
  check (declared_size_bytes between 1 and 21474836480);
create or replace function private.guard_mux_upload_reservation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.profiles where id=new.created_by for update;
  if not private.account_active(new.created_by) then raise exception 'account_inactive'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mux-upload:'||new.organization_id::text,0));
  if not exists(select 1 from public.lessons l join public.courses c on c.id=l.course_id
      where l.id=new.lesson_id and c.id=new.course_id and c.organization_id=new.organization_id)
    or not (exists(select 1 from public.organization_admins a where a.organization_id=new.organization_id and a.user_id=new.created_by)
      or exists(select 1 from public.profiles p where p.id=new.created_by and p.is_super_admin))
    then raise exception 'upload_scope_denied'; end if;
  if (select count(*) from public.video_assets where created_by=new.created_by and created_at>now()-interval '10 minutes')>=10
    or (select count(*) from public.video_assets where organization_id=new.organization_id and created_at>now()-interval '10 minutes')>=30
    or (select count(*) from public.video_assets where created_by=new.created_by and status in ('waiting_for_upload','processing') and created_at>now()-interval '25 hours')>=3
    or (select count(*) from public.video_assets where organization_id=new.organization_id and status in ('waiting_for_upload','processing') and created_at>now()-interval '25 hours')>=10
    then raise exception 'upload_rate_limited'; end if;
  return new;
end;
$$;
create trigger guard_mux_upload_reservation before insert on public.video_assets
for each row execute function private.guard_mux_upload_reservation();
revoke all on function private.guard_mux_upload_reservation() from public,anon,authenticated;

create or replace function public.register_mux_direct_upload(
  p_video_asset_id uuid,p_organization_id uuid,p_course_id uuid,p_lesson_id uuid,
  p_block_id uuid,p_created_by uuid,p_mux_upload_id text)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if p_mux_upload_id is null or length(trim(p_mux_upload_id))=0 then raise exception 'mux_upload_required'; end if;
  -- New code has already reserved the row. Old code remains compatible.
  update public.video_assets set mux_upload_id=p_mux_upload_id where id=p_video_asset_id
    and organization_id=p_organization_id and course_id=p_course_id and lesson_id=p_lesson_id
    and block_id=p_block_id and created_by=p_created_by and mux_upload_id is null;
  if not found then
    insert into public.video_assets(id,organization_id,course_id,lesson_id,block_id,created_by,mux_upload_id,status,is_current)
      values(p_video_asset_id,p_organization_id,p_course_id,p_lesson_id,p_block_id,p_created_by,p_mux_upload_id,'waiting_for_upload',false);
  end if;
  return p_video_asset_id;
end;
$$;
