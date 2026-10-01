-- Compatible rollout: legacy contracts have NULL offer_version and observe mode.
-- All monetary values are integer cents; durations are seconds (numeric precision).
alter table public.organization_billing
  add column offer_version text,
  add column plan_key text check (plan_key in ('inicio','crece','academia','trial','custom')),
  add column accepted_offer jsonb,
  add column accepted_at timestamptz,
  add column accepted_by uuid references public.profiles(id) on delete set null,
  add column quota_mode text not null default 'observe' check (quota_mode in ('observe','enforce')),
  add column library_limit_seconds numeric not null default 0 check (library_limit_seconds>=0),
  add column economic_limit_seconds numeric not null default 0 check (economic_limit_seconds>=0),
  add column library_extension_quantity integer not null default 0 check (library_extension_quantity>=0),
  add column scheduled_plan_key text,
  add column scheduled_library_quantity integer,
  add column stripe_schedule_id text,
  add column commercial_last_synced_at timestamptz,
  add column effective_ended_at timestamptz,
  add column retention_until timestamptz,
  add column retention_policy_version text,
  add column library_excess_since timestamptz;

create table public.platform_capacity_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  starts_at timestamptz not null, ends_at timestamptz not null,
  subscription_id text, plan_key text not null, offer_snapshot jsonb not null,
  base_seconds numeric not null check (base_seconds>=0),
  grace_seconds numeric not null check (grace_seconds>=0),
  base_used_seconds numeric not null default 0,
  grace_used_seconds numeric not null default 0,
  excess_seconds numeric not null default 0,
  check (ends_at>starts_at), unique(organization_id,starts_at)
);
create index platform_capacity_cycles_org_end on public.platform_capacity_cycles(organization_id,ends_at);
create table public.platform_capacity_increases (
  id text primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
  cycle_id uuid not null references public.platform_capacity_cycles(id) on delete restrict,
  effective_at timestamptz not null, base_seconds numeric not null check(base_seconds>=0),
  grace_seconds numeric not null check(grace_seconds>=0), offer_snapshot jsonb not null
);
create index platform_capacity_increases_cycle on public.platform_capacity_increases(cycle_id,effective_at);
create table public.platform_delivery_packs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  source_id text not null unique, starts_at timestamptz not null, expires_at timestamptz not null,
  granted_seconds numeric not null check(granted_seconds>0), used_seconds numeric not null default 0,
  paid_cents integer, refunded_at timestamptz, granted_by uuid references public.profiles(id) on delete set null,
  reason text, offer_snapshot jsonb not null, check(expires_at>starts_at),
  check(paid_cents is not null or (granted_by is not null and length(reason)>0))
);
create index platform_delivery_packs_org_expiry on public.platform_delivery_packs(organization_id,expires_at,id);
create table public.platform_pack_refunds (
  refund_id text primary key, pack_id uuid not null references public.platform_delivery_packs(id) on delete restrict,
  amount_cents integer not null check(amount_cents>0), seconds numeric not null check(seconds>0), effective_at timestamptz not null
);
create index platform_pack_refunds_pack on public.platform_pack_refunds(pack_id,effective_at);
create table public.platform_invoice_ledger (
  invoice_id text primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
  subscription_id text not null, currency text not null, amount_paid_cents integer not null, total_cents integer not null,
  paid_at timestamptz not null, period_start timestamptz not null, period_end timestamptz not null,
  provider_snapshot jsonb not null, updated_at timestamptz not null default now()
);
create table public.platform_billing_operations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check(kind in ('subscribe','upgrade','downgrade','library','delivery_pack','cancel','resume')),
  status text not null default 'quoted' check(status in ('quoted','processing','pending_payment','scheduled','completed','expired','failed')),
  quote jsonb not null, offer_snapshot jsonb not null,
  stripe_params jsonb not null default '{}'::jsonb,
  provider_id text, invoice_id text, checkout_attempt_id uuid references public.stripe_checkout_attempts(id) on delete restrict,
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  applied_at timestamptz, last_error text
);
create unique index platform_billing_one_processing on public.platform_billing_operations(organization_id)
  where status in ('processing','pending_payment');
create index platform_billing_operations_org on public.platform_billing_operations(organization_id,created_at);

-- Durable attribution and supplier minimum commitment survive video_assets deletion.
create table public.mux_asset_ledger (
  video_asset_id uuid primary key, organization_id uuid not null references public.organizations(id) on delete restrict,
  environment text not null, mux_asset_id text,
  duration_seconds numeric check(duration_seconds>0), state text not null,
  created_at timestamptz not null, provider_created_at timestamptz,
  minimum_storage_until timestamptz,
  deletion_requested_at timestamptz, deletion_confirmed_at timestamptz,
  updated_at timestamptz not null default now(), unique(environment,mux_asset_id)
);
create index mux_asset_ledger_org on public.mux_asset_ledger(organization_id);
alter table public.video_assets add column mux_environment text not null default 'legacy-unverified',
  add column reserved_duration_seconds numeric check(reserved_duration_seconds>0 and reserved_duration_seconds<=43200),
  add column reservation_expires_at timestamptz not null default (now()+interval '25 hours');
insert into public.mux_asset_ledger(video_asset_id,organization_id,environment,mux_asset_id,duration_seconds,state,created_at,minimum_storage_until)
 select id,organization_id,mux_environment,mux_asset_id,duration_seconds,status,created_at,created_at+interval '30 days' from public.video_assets;

create table public.mux_usage_hours (
  environment text not null, mux_asset_id text not null, starts_at timestamptz not null,
  organization_id uuid references public.organizations(id) on delete restrict,
  delivered_seconds numeric not null check(delivered_seconds>=0), resolution_seconds jsonb not null,
  provider_metadata jsonb not null, updated_at timestamptz not null default now(),
  primary key(environment,mux_asset_id,starts_at)
);
create index mux_usage_hours_org_time on public.mux_usage_hours(organization_id,starts_at);
create table public.mux_usage_imports (
  environment text not null, starts_at timestamptz not null,
  ends_at timestamptz not null, updated_at timestamptz not null default now(),
  status text not null check(status in ('complete','failed')), row_count integer,
  error_message text, previous_payload jsonb, revision integer not null default 1,
  primary key(environment,starts_at), check(ends_at=starts_at+interval '1 hour')
);
create table public.mux_usage_revisions (
  id bigint generated always as identity primary key, environment text not null, starts_at timestamptz not null,
  previous_payload jsonb not null, replaced_at timestamptz not null default now()
);
create table public.platform_usage_allocations (
  environment text not null, mux_asset_id text not null, starts_at timestamptz not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  cycle_id uuid references public.platform_capacity_cycles(id) on delete restrict,
  base_seconds numeric not null, pack_allocations jsonb not null,
  grace_seconds numeric not null, excess_seconds numeric not null,
  primary key(environment,mux_asset_id,starts_at)
);
create index platform_usage_allocations_org on public.platform_usage_allocations(organization_id);
create table public.platform_playback_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  video_asset_id uuid not null, created_at timestamptz not null default now(), expires_at timestamptz not null,
  check(expires_at>created_at)
);
create index platform_playback_sessions_org on public.platform_playback_sessions(organization_id,expires_at);
create table public.platform_resource_notices (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  resource text not null, cycle_key text not null, threshold text not null,
  payload jsonb not null, created_at timestamptz not null default now(), sent_at timestamptz,
  lease_until timestamptz, attempts integer not null default 0, last_error text,
  unique(organization_id,resource,cycle_key,threshold)
);
create table public.platform_retention_jobs (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  policy_version text not null, ended_at timestamptz not null, delete_after timestamptz not null,
  status text not null default 'pending' check(status in ('pending','processing','canceled','completed','failed')),
  lease_until timestamptz, attempts integer not null default 0, last_error text, completed_at timestamptz,
  check(delete_after>=ended_at+interval '30 days')
);
create table public.platform_custom_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  message text not null check(length(message) between 10 and 2000), created_at timestamptz not null default now()
);
create table public.platform_quota_exceptions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  resource text not null check(resource in ('delivery','library','admission')),
  quantity_seconds numeric not null check(quantity_seconds>=0), reason text not null check(length(reason)>0),
  starts_at timestamptz not null default now(), expires_at timestamptz not null, check(expires_at>starts_at)
);

-- Private server tables: no Data API path accepts prices or balances from clients.
do $$ declare t text; begin
 foreach t in array array['platform_capacity_cycles','platform_capacity_increases','platform_delivery_packs',
 'platform_billing_operations','mux_asset_ledger','mux_usage_hours','mux_usage_imports','mux_usage_revisions',
 'platform_usage_allocations','platform_playback_sessions','platform_resource_notices','platform_retention_jobs',
 'platform_custom_requests','platform_quota_exceptions','platform_pack_refunds','platform_invoice_ledger'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.mux_usage_revisions_id_seq to service_role;

create or replace function private.sync_mux_asset_ledger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then
  update public.mux_asset_ledger set deletion_requested_at=coalesce(deletion_requested_at,now()),updated_at=now() where video_asset_id=old.id;
  return old;
 end if;
 insert into public.mux_asset_ledger(video_asset_id,organization_id,environment,mux_asset_id,duration_seconds,state,created_at,minimum_storage_until)
 values(new.id,new.organization_id,new.mux_environment,new.mux_asset_id,new.duration_seconds,new.status,new.created_at,new.created_at+interval '30 days')
 on conflict(video_asset_id) do update set environment=excluded.environment,mux_asset_id=coalesce(excluded.mux_asset_id,mux_asset_ledger.mux_asset_id),
 duration_seconds=coalesce(excluded.duration_seconds,mux_asset_ledger.duration_seconds),state=excluded.state,updated_at=now();
 return new;
end $$;
revoke all on function private.sync_mux_asset_ledger() from public,anon,authenticated;
create trigger sync_mux_asset_ledger after insert or update or delete on public.video_assets for each row execute function private.sync_mux_asset_ledger();
create or replace function private.confirm_mux_deletion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='completed' then
  update public.mux_asset_ledger set deletion_confirmed_at=coalesce(deletion_confirmed_at,new.completed_at,now()),updated_at=now() where video_asset_id=new.video_asset_id;
 end if; return new;
end $$;
revoke all on function private.confirm_mux_deletion() from public,anon,authenticated;
create trigger confirm_mux_deletion after update on public.mux_deletion_jobs for each row execute function private.confirm_mux_deletion();

create or replace function public.platform_library_usage(p_organization_id uuid) returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'active_seconds',coalesce((select sum(duration_seconds) from mux_asset_ledger where organization_id=p_organization_id and deletion_confirmed_at is null),0),
 'reserved_seconds',coalesce((select sum(reserved_duration_seconds) from video_assets where organization_id=p_organization_id and status in ('waiting_for_upload','processing') and reservation_expires_at>now() and duration_seconds is null),0),
 'committed_seconds',coalesce((select sum(duration_seconds) from mux_asset_ledger where organization_id=p_organization_id and deletion_confirmed_at is not null and minimum_storage_until>now()),0),
 'release_at',(select min(minimum_storage_until) from mux_asset_ledger where organization_id=p_organization_id and deletion_confirmed_at is not null and minimum_storage_until>now()),
 'unconfirmed_assets',(select count(*) from mux_asset_ledger where organization_id=p_organization_id and mux_asset_id is not null and duration_seconds is null));
$$;
revoke all on function public.platform_library_usage(uuid) from public,anon,authenticated;
grant execute on function public.platform_library_usage(uuid) to service_role;

create or replace function private.guard_platform_library_quota() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.organization_billing; u jsonb; active numeric; reserved numeric; committed numeric; extra numeric;
begin
 select * into b from public.organization_billing where organization_id=new.organization_id for update;
 if b.quota_mode<>'enforce' or b.offer_version is null then return new; end if;
 u:=public.platform_library_usage(new.organization_id);
 active:=(u->>'active_seconds')::numeric; reserved:=(u->>'reserved_seconds')::numeric; committed:=(u->>'committed_seconds')::numeric;
 select coalesce(sum(quantity_seconds),0) into extra from public.platform_quota_exceptions where organization_id=new.organization_id and resource='library' and starts_at<=now() and expires_at>now();
 if tg_op='INSERT' then
  if new.reserved_duration_seconds is null then raise exception 'video_duration_estimate_required'; end if;
  if active+reserved+new.reserved_duration_seconds>b.library_limit_seconds+extra or active+reserved+committed+new.reserved_duration_seconds>b.economic_limit_seconds+extra*1.2 then raise exception 'library_capacity_exceeded'; end if;
 elsif new.status='ready' and new.duration_seconds is not null then
  active:=active-coalesce(old.duration_seconds,0);
  if old.duration_seconds is null and old.status in ('waiting_for_upload','processing') and old.reservation_expires_at>now() then reserved:=reserved-coalesce(old.reserved_duration_seconds,0); end if;
  if active+reserved+new.duration_seconds>b.library_limit_seconds+extra or active+reserved+committed+new.duration_seconds>b.economic_limit_seconds+extra*1.2 then
   new.status:='errored'; new.error_type:='library_capacity_exceeded'; new.error_message:='La duración confirmada supera la capacidad disponible. Amplía o libera biblioteca antes de publicar.'; new.is_current:=false;
  end if;
 end if; return new;
end $$;
revoke all on function private.guard_platform_library_quota() from public,anon,authenticated;
create trigger guard_platform_library_quota before insert or update of status,duration_seconds on public.video_assets for each row execute function private.guard_platform_library_quota();

-- Rebuild under the same school row lock used by purchases and reservations.
create or replace function public.rebuild_platform_usage(p_organization_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; c public.platform_capacity_cycles; p public.platform_delivery_packs; base_limit numeric; grace_limit numeric; rest numeric; bs numeric; gs numeric; take numeric; pa jsonb;
begin
 perform 1 from public.organization_billing where organization_id=p_organization_id for update;
 delete from public.platform_usage_allocations where organization_id=p_organization_id;
 update public.platform_capacity_cycles set base_used_seconds=0,grace_used_seconds=0,excess_seconds=0 where organization_id=p_organization_id;
 update public.platform_delivery_packs set used_seconds=0 where organization_id=p_organization_id;
 for r in select * from public.mux_usage_hours where organization_id=p_organization_id order by starts_at,environment,mux_asset_id loop
  select * into c from public.platform_capacity_cycles where organization_id=p_organization_id and starts_at<=r.starts_at and ends_at>r.starts_at order by starts_at desc limit 1;
  rest:=r.delivered_seconds; bs:=0; gs:=0; pa:='[]'::jsonb;
  if c.id is not null then
   select c.base_seconds+coalesce(sum(base_seconds),0),c.grace_seconds+coalesce(sum(grace_seconds),0) into base_limit,grace_limit from public.platform_capacity_increases where cycle_id=c.id and effective_at<=r.starts_at;
   bs:=least(rest,greatest(0,base_limit-c.base_used_seconds)); rest:=rest-bs;
   for p in select * from public.platform_delivery_packs where organization_id=p_organization_id and starts_at<=r.starts_at and expires_at>r.starts_at and (refunded_at is null or refunded_at>r.starts_at) order by expires_at,id loop
    take:=least(rest,greatest(0,p.granted_seconds-p.used_seconds-coalesce((select sum(seconds) from public.platform_pack_refunds where pack_id=p.id and effective_at<=r.starts_at),0))); rest:=rest-take;
    if take>0 then pa:=pa||jsonb_build_array(jsonb_build_object('id',p.id,'seconds',take)); update public.platform_delivery_packs set used_seconds=used_seconds+take where id=p.id; end if;
    exit when rest<=0;
   end loop;
   gs:=least(rest,greatest(0,grace_limit-c.grace_used_seconds)); rest:=rest-gs;
   update public.platform_capacity_cycles set base_used_seconds=base_used_seconds+bs,grace_used_seconds=grace_used_seconds+gs,excess_seconds=excess_seconds+rest where id=c.id;
  end if;
  insert into public.platform_usage_allocations values(r.environment,r.mux_asset_id,r.starts_at,p_organization_id,c.id,bs,pa,gs,rest);
 end loop;
end $$;
revoke all on function public.rebuild_platform_usage(uuid) from public,anon,authenticated;
grant execute on function public.rebuild_platform_usage(uuid) to service_role;

create or replace function public.refund_platform_delivery_pack(p_source_id text,p_refund_id text,p_refund_cents integer,p_refunded_at timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.platform_delivery_packs;
begin
 select * into p from public.platform_delivery_packs where source_id=p_source_id;
 if p.id is null then raise exception 'pack_payment_missing'; end if;
 perform 1 from public.organization_billing where organization_id=p.organization_id for update;
 if p_refund_cents<=0 or p_refund_cents>p.paid_cents then raise exception 'invalid_pack_refund'; end if;
 insert into public.platform_pack_refunds(refund_id,pack_id,amount_cents,seconds,effective_at)
 values(p_refund_id,p.id,p_refund_cents,floor(p.granted_seconds*p_refund_cents/p.paid_cents),p_refunded_at) on conflict(refund_id) do nothing;
 if (select sum(amount_cents) from public.platform_pack_refunds where pack_id=p.id)>p.paid_cents then raise exception 'pack_refund_exceeds_payment'; end if;
 perform public.rebuild_platform_usage(p.organization_id);
end $$;
revoke all on function public.refund_platform_delivery_pack(text,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.refund_platform_delivery_pack(text,text,integer,timestamptz) to service_role;

create or replace function public.replace_mux_usage_hour(p_environment text,p_start timestamptz,p_rows jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare previous jsonb; r jsonb; org uuid; affected uuid[]; target uuid;
begin
 if p_start<>date_trunc('hour',p_start at time zone 'UTC') at time zone 'UTC' or p_start+interval '1 hour'>date_trunc('hour',now())-interval '12 hours' or jsonb_typeof(p_rows)<>'array' then raise exception 'invalid_mux_usage_window'; end if;
 perform pg_advisory_xact_lock(hashtextextended('mux-usage:'||p_environment,0));
 select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb),array_agg(distinct organization_id) into previous,affected from public.mux_usage_hours h where environment=p_environment and starts_at=p_start;
 if previous<>'[]'::jsonb then insert into public.mux_usage_revisions(environment,starts_at,previous_payload) values(p_environment,p_start,previous); end if;
 delete from public.mux_usage_hours where environment=p_environment and starts_at=p_start;
 for r in select value from jsonb_array_elements(p_rows) loop
  select organization_id into org from public.mux_asset_ledger where environment=p_environment and mux_asset_id=r->>'asset_id';
  insert into public.mux_usage_hours(environment,mux_asset_id,starts_at,organization_id,delivered_seconds,resolution_seconds,provider_metadata)
  values(p_environment,r->>'asset_id',p_start,org,(r->>'delivered_seconds')::numeric,coalesce(r->'delivered_seconds_by_resolution','{}'::jsonb),r);
  if org is not null then affected:=array_append(affected,org); end if;
 end loop;
 insert into public.mux_usage_imports(environment,starts_at,ends_at,status,row_count,previous_payload)
 values(p_environment,p_start,p_start+interval '1 hour','complete',jsonb_array_length(p_rows),previous)
 on conflict(environment,starts_at) do update set status='complete',updated_at=now(),row_count=excluded.row_count,error_message=null,previous_payload=excluded.previous_payload,revision=mux_usage_imports.revision+1;
 for target in select distinct x from unnest(affected) x where x is not null order by x loop perform public.rebuild_platform_usage(target); end loop;
end $$;
revoke all on function public.replace_mux_usage_hour(text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.replace_mux_usage_hour(text,timestamptz,jsonb) to service_role;

-- Paid state is verified against Stripe by the server before calling this RPC.
-- An operation is applied exactly once even if webhook completion recording fails.
create or replace function public.apply_platform_capacity_payment(p_operation_id uuid,p_subscription_id text,p_cycle_start timestamptz,p_cycle_end timestamptz,p_confirmed_at timestamptz,p_source_id text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.platform_billing_operations; b public.organization_billing; c public.platform_capacity_cycles; s jsonb; delta numeric; grace_delta numeric; ratio numeric; quantity integer;
begin
 select * into o from public.platform_billing_operations where id=p_operation_id;
 if o.id is null then raise exception 'billing_operation_missing'; end if;
 select * into b from public.organization_billing where organization_id=o.organization_id for update;
 select * into o from public.platform_billing_operations where id=p_operation_id for update;
 if o.applied_at is not null then return; end if;
 s:=o.offer_snapshot;
 if s->>'version'<>'2026-10-01' or s->>'taxBehavior'<>'inclusive' or s->>'currency'<>'eur' then raise exception 'unrecognized_offer'; end if;
 if o.kind='delivery_pack' then
  insert into public.platform_delivery_packs(organization_id,source_id,starts_at,expires_at,granted_seconds,paid_cents,offer_snapshot)
  values(o.organization_id,p_source_id,p_confirmed_at,p_confirmed_at+interval '90 days',300000,2000,s) on conflict(source_id) do nothing;
 else
  if p_subscription_id is null or p_cycle_end<=p_cycle_start then raise exception 'invalid_capacity_period'; end if;
  if b.platform_subscription_id is distinct from p_subscription_id then raise exception 'subscription_changed'; end if;
  if b.commercial_last_synced_at>p_confirmed_at then raise exception 'stale_commercial_operation'; end if;
  select * into c from public.platform_capacity_cycles where organization_id=o.organization_id and starts_at=p_cycle_start;
  if o.kind in ('subscribe','upgrade') then
   if c.id is null then
    if exists(select 1 from public.platform_capacity_cycles where organization_id=o.organization_id and starts_at<p_cycle_end and ends_at>p_cycle_start and plan_key<>'trial') then raise exception 'overlapping_capacity_period'; end if;
    -- End the manual trial when the explicit paid period starts.
    update public.platform_capacity_cycles set ends_at=p_cycle_start where organization_id=o.organization_id and plan_key='trial' and starts_at<p_cycle_start and ends_at>p_cycle_start;
    insert into public.platform_capacity_cycles(organization_id,starts_at,ends_at,subscription_id,plan_key,offer_snapshot,base_seconds,grace_seconds)
    values(o.organization_id,p_cycle_start,p_cycle_end,p_subscription_id,s->>'planKey',s,(s->>'deliverySeconds')::numeric,(s->>'graceSeconds')::numeric);
   elsif o.kind='upgrade' then
    ratio:=greatest(0,least(1,extract(epoch from (p_cycle_end-(o.quote->>'prorationAt')::timestamptz))/extract(epoch from (p_cycle_end-p_cycle_start))));
    delta:=floor(greatest(0,(s->>'deliverySeconds')::numeric-(b.accepted_offer->>'deliverySeconds')::numeric)*ratio);
    grace_delta:=floor(greatest(0,(s->>'graceSeconds')::numeric-(b.accepted_offer->>'graceSeconds')::numeric)*ratio);
    insert into public.platform_capacity_increases(id,organization_id,cycle_id,effective_at,base_seconds,grace_seconds,offer_snapshot)
    values(p_source_id,o.organization_id,c.id,p_confirmed_at,delta,grace_delta,s) on conflict(id) do nothing;
   end if;
   update public.organization_billing set plan_key=s->>'planKey',offer_version=s->>'version',accepted_offer=s,accepted_at=coalesce(accepted_at,o.created_at),accepted_by=o.actor_id,
   retention_policy_version=s->>'retentionPolicyVersion',effective_ended_at=null,retention_until=null,
   library_limit_seconds=(s->>'librarySeconds')::numeric+library_extension_quantity*36000,
   economic_limit_seconds=(s->>'economicSeconds')::numeric+library_extension_quantity*43200,
   access_mode='standard',commercial_last_synced_at=p_confirmed_at where organization_id=o.organization_id;
  elsif o.kind='library' then
   quantity:=(o.quote->>'libraryQuantity')::integer;
   update public.organization_billing set library_extension_quantity=quantity,
   library_limit_seconds=(accepted_offer->>'librarySeconds')::numeric+quantity*36000,
   economic_limit_seconds=(accepted_offer->>'economicSeconds')::numeric+quantity*43200,
   commercial_last_synced_at=p_confirmed_at where organization_id=o.organization_id;
  end if;
  update public.platform_retention_jobs set status='canceled',lease_until=null where organization_id=o.organization_id and status<>'completed';
 end if;
 update public.platform_billing_operations set status='completed',applied_at=now(),last_error=null where id=o.id;
 perform public.rebuild_platform_usage(o.organization_id);
end $$;
revoke all on function public.apply_platform_capacity_payment(uuid,text,timestamptz,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.apply_platform_capacity_payment(uuid,text,timestamptz,timestamptz,timestamptz,text) to service_role;

create or replace function public.renew_platform_capacity_cycle(p_organization_id uuid,p_subscription_id text,p_start timestamptz,p_end timestamptz,p_offer jsonb,p_library_quantity integer,p_paid_cents integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.organization_billing;
begin
 select * into b from public.organization_billing where organization_id=p_organization_id for update;
 if b.offer_version is null then return; end if;
 if b.platform_subscription_id is distinct from p_subscription_id or p_end<=p_start or p_library_quantity<0 then raise exception 'invalid_renewal'; end if;
 if p_offer->>'version'<>'2026-10-01' then raise exception 'invalid_renewal_offer'; end if;
 if exists(select 1 from public.platform_capacity_cycles where organization_id=p_organization_id and starts_at=p_start) then return; end if;
 if exists(select 1 from public.platform_capacity_cycles where organization_id=p_organization_id and starts_at<p_end and ends_at>p_start and plan_key<>'trial') then raise exception 'overlapping_renewal'; end if;
 insert into public.platform_capacity_cycles(organization_id,starts_at,ends_at,subscription_id,plan_key,offer_snapshot,base_seconds,grace_seconds)
 values(p_organization_id,p_start,p_end,p_subscription_id,p_offer->>'planKey',p_offer,(p_offer->>'deliverySeconds')::numeric,(p_offer->>'graceSeconds')::numeric);
 update public.organization_billing set plan_key=p_offer->>'planKey',accepted_offer=p_offer,library_extension_quantity=p_library_quantity,
 library_limit_seconds=(p_offer->>'librarySeconds')::numeric+p_library_quantity*36000,economic_limit_seconds=(p_offer->>'economicSeconds')::numeric+p_library_quantity*43200,
 scheduled_plan_key=null,scheduled_library_quantity=null,effective_ended_at=null,retention_until=null where organization_id=p_organization_id;
 update public.platform_retention_jobs set status='canceled',lease_until=null where organization_id=p_organization_id and status<>'completed';
 perform public.rebuild_platform_usage(p_organization_id);
end $$;
revoke all on function public.renew_platform_capacity_cycle(uuid,text,timestamptz,timestamptz,jsonb,integer,integer) from public,anon,authenticated;
grant execute on function public.renew_platform_capacity_cycle(uuid,text,timestamptz,timestamptz,jsonb,integer,integer) to service_role;

create table public.platform_trial_claims (
 owner_fingerprint text primary key, organization_id uuid not null unique references public.organizations(id) on delete restrict,
 claimed_at timestamptz not null default now()
);
alter table public.platform_trial_claims enable row level security;
revoke all on public.platform_trial_claims from public,anon,authenticated;
grant all on public.platform_trial_claims to service_role;
create or replace function public.start_platform_trial(p_organization_id uuid,p_offer jsonb) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.organization_billing; fingerprint text; trial_start timestamptz:=now();
begin
 select * into b from public.organization_billing where organization_id=p_organization_id for update;
 if b.offer_version is not null or b.access_mode<>'standard' or b.platform_subscription_id is not null then return false; end if;
 if not exists(select 1 from public.organizations where id=p_organization_id and created_at>now()-interval '15 minutes') then return false; end if;
 select encode(extensions.digest(lower(p.email),'sha256'),'hex') into fingerprint from public.organizations o join public.profiles p on p.id=o.owner_id where o.id=p_organization_id;
 insert into public.platform_trial_claims(owner_fingerprint,organization_id) values(fingerprint,p_organization_id) on conflict do nothing;
 if not found then return false; end if;
 update public.organization_billing set plan_key='trial',offer_version='2026-10-01',accepted_offer=p_offer,accepted_at=trial_start,accepted_by=(select owner_id from public.organizations where id=p_organization_id),
 retention_policy_version='2026-10-01',access_mode='trial',access_expires_at=trial_start+interval '14 days',library_limit_seconds=7200,economic_limit_seconds=8640 where organization_id=p_organization_id;
 insert into public.platform_capacity_cycles(organization_id,starts_at,ends_at,plan_key,offer_snapshot,base_seconds,grace_seconds)
 values(p_organization_id,trial_start,trial_start+interval '14 days','trial',p_offer,18000,0);
 return true;
end $$;
revoke all on function public.start_platform_trial(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_platform_trial(uuid,jsonb) to service_role;

create or replace function public.admit_platform_playback(p_organization_id uuid,p_user_id uuid,p_video_asset_id uuid,p_session_id uuid default null,p_lifetime integer default 900) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.organization_billing; c public.platform_capacity_cycles; ps public.platform_playback_sessions; base_limit numeric; grace_limit numeric; remaining numeric; exception_allowed boolean;
begin
 select * into b from public.organization_billing where organization_id=p_organization_id for update;
 -- Server has checked course/roster/asset permissions. This handles only commercial admission.
 if p_session_id is not null then
  select * into ps from public.platform_playback_sessions where id=p_session_id and user_id=p_user_id and organization_id=p_organization_id and video_asset_id=p_video_asset_id and expires_at>now();
  if ps.id is not null then return jsonb_build_object('allowed',true,'sessionId',ps.id,'expiresAt',ps.expires_at,'existing',true); end if;
  return jsonb_build_object('allowed',false,'reason','session_expired');
 end if;
 if b.quota_mode='enforce' and b.offer_version is not null then
  if not (b.platform_subscription_status in ('active','trialing','past_due') or (b.access_mode='complimentary' and (b.access_expires_at is null or b.access_expires_at>now())) or (b.access_mode='trial' and b.access_expires_at>now())) then return jsonb_build_object('allowed',false,'reason','school_access_ended'); end if;
  if b.library_excess_since is not null and b.library_excess_since+interval '7 days'<=now() then return jsonb_build_object('allowed',false,'reason','library_excess'); end if;
  select exists(select 1 from public.platform_quota_exceptions where organization_id=p_organization_id and resource='admission' and starts_at<=now() and expires_at>now()) into exception_allowed;
  select * into c from public.platform_capacity_cycles where organization_id=p_organization_id and starts_at<=now() and ends_at>now() order by starts_at desc limit 1;
  if c.id is null then
   -- Await provider reconciliation rather than turning unavailable usage into zero.
   return jsonb_build_object('allowed',true,'state','pending_update');
  end if;
  select c.base_seconds+coalesce(sum(base_seconds),0),c.grace_seconds+coalesce(sum(grace_seconds),0) into base_limit,grace_limit from public.platform_capacity_increases where cycle_id=c.id;
  select coalesce(sum(greatest(0,granted_seconds-used_seconds-coalesce((select sum(seconds) from public.platform_pack_refunds r where r.pack_id=platform_delivery_packs.id and r.effective_at<=now()),0))),0) into remaining from public.platform_delivery_packs where organization_id=p_organization_id and starts_at<=now() and expires_at>now() and refunded_at is null;
  if not exception_allowed and base_limit<=c.base_used_seconds and grace_limit<=c.grace_used_seconds and remaining<=0 then return jsonb_build_object('allowed',false,'reason','delivery_paused'); end if;
 end if;
 if p_lifetime<900 or p_lifetime>44100 then raise exception 'invalid_playback_lifetime'; end if;
 insert into public.platform_playback_sessions(user_id,organization_id,video_asset_id,expires_at) values(p_user_id,p_organization_id,p_video_asset_id,now()+make_interval(secs=>p_lifetime)) returning * into ps;
 return jsonb_build_object('allowed',true,'sessionId',ps.id,'expiresAt',ps.expires_at,'existing',false);
end $$;
revoke all on function public.admit_platform_playback(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.admit_platform_playback(uuid,uuid,uuid,uuid,integer) to service_role;

alter table public.stripe_checkout_attempts drop constraint stripe_checkout_attempts_checkout_kind_check;
alter table public.stripe_checkout_attempts add constraint stripe_checkout_attempts_checkout_kind_check check(checkout_kind in ('course_purchase','platform_subscription','platform_delivery_pack'));
alter table public.stripe_checkout_attempts drop constraint stripe_checkout_attempts_shape_check;
alter table public.stripe_checkout_attempts add constraint stripe_checkout_attempts_shape_check check (
 (checkout_kind='course_purchase' and course_id is not null and stripe_account_id is not null and expected_amount_total>=0)
 or (checkout_kind='platform_subscription' and course_id is null and stripe_account_id is null and expected_amount_total is null)
 or (checkout_kind='platform_delivery_pack' and course_id is null and stripe_account_id is null and expected_amount_total=2000));
create unique index stripe_checkout_attempts_active_pack_idx on public.stripe_checkout_attempts(organization_id) where checkout_kind='platform_delivery_pack' and status in ('creating','open');
