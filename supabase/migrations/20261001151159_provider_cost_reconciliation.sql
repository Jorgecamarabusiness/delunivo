-- Actual provider evidence is separate from entitlements and reference prices.
create table public.platform_provider_statements (
 id text primary key,provider text not null,environment text not null,currency text not null,
 starts_at timestamptz not null,ends_at timestamptz not null,source text not null check(length(source)>3),
 gross_cents bigint not null check(gross_cents>=0),discount_cents bigint not null check(discount_cents>=0),credit_cents bigint not null check(credit_cents>=0),
 tax_cents bigint not null check(tax_cents>=0),paid_cents bigint not null check(paid_cents>=0),
 usd_to_eur numeric(20,10),fx_at timestamptz,fx_source text,
 recorded_by uuid not null,updated_at timestamptz not null default now(),
 check(ends_at>starts_at),check(gross_cents-discount_cents-credit_cents+tax_cents=paid_cents),
 check(usd_to_eur is null or usd_to_eur>0 and fx_at is not null and length(fx_source)>3)
);
create table public.platform_provider_cost_lines (
 statement_id text not null references public.platform_provider_statements(id) on delete restrict,line_key text not null,
 organization_id uuid references public.organizations(id) on delete restrict,mux_asset_id text,
 category text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 amount_micro_units bigint not null check(amount_micro_units>=0),source_payload jsonb not null,
 primary key(statement_id,line_key),check(ends_at>starts_at)
);
create index platform_provider_cost_lines_org_time on public.platform_provider_cost_lines(organization_id,starts_at,ends_at);
create table public.platform_provider_cost_revisions (
 id bigint generated always as identity primary key,statement_id text not null,previous_payload jsonb not null,
 actor_id uuid not null,replaced_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['platform_provider_statements','platform_provider_cost_lines','platform_provider_cost_revisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant all on sequence public.platform_provider_cost_revisions_id_seq to service_role;
alter table public.platform_delivery_packs add column provider_payment_snapshot jsonb;

create or replace function public.record_platform_provider_statement(p_actor_id uuid,p_statement jsonb,p_lines jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare key text:=p_statement->>'id'; l jsonb; target_org uuid; previous jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and is_super_admin and account_status='active') then raise exception 'platform_admin_required'; end if;
 if key is null or length(key)>200 or jsonb_typeof(p_lines)<>'array' then raise exception 'invalid_statement'; end if;
 perform pg_advisory_xact_lock(hashtextextended('provider-statement:'||key,0));
 select to_jsonb(s)||jsonb_build_object('lines',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.platform_provider_cost_lines x where x.statement_id=key)) into previous from public.platform_provider_statements s where s.id=key;
 if previous is not null then insert into public.platform_provider_cost_revisions(statement_id,previous_payload,actor_id) values(key,previous,p_actor_id); end if;
 insert into public.platform_provider_statements(id,provider,environment,currency,starts_at,ends_at,source,gross_cents,discount_cents,credit_cents,tax_cents,paid_cents,usd_to_eur,fx_at,fx_source,recorded_by)
 values(key,p_statement->>'provider',p_statement->>'environment',p_statement->>'currency',(p_statement->>'startsAt')::timestamptz,(p_statement->>'endsAt')::timestamptz,p_statement->>'source',
 (p_statement->>'grossCents')::bigint,(p_statement->>'discountCents')::bigint,(p_statement->>'creditCents')::bigint,(p_statement->>'taxCents')::bigint,(p_statement->>'paidCents')::bigint,
 (p_statement->>'usdToEur')::numeric,(p_statement->>'fxAt')::timestamptz,p_statement->>'fxSource',p_actor_id)
 on conflict(id) do update set provider=excluded.provider,environment=excluded.environment,currency=excluded.currency,starts_at=excluded.starts_at,ends_at=excluded.ends_at,source=excluded.source,
 gross_cents=excluded.gross_cents,discount_cents=excluded.discount_cents,credit_cents=excluded.credit_cents,tax_cents=excluded.tax_cents,paid_cents=excluded.paid_cents,
 usd_to_eur=excluded.usd_to_eur,fx_at=excluded.fx_at,fx_source=excluded.fx_source,recorded_by=p_actor_id,updated_at=now();
 delete from public.platform_provider_cost_lines where statement_id=key;
 for l in select value from jsonb_array_elements(p_lines) loop
  target_org:=null;
  if p_statement->>'provider'='mux' then
   select organization_id into target_org from public.mux_asset_ledger where environment=p_statement->>'environment' and mux_asset_id=l->>'assetId';
  else target_org:=(l->>'organizationId')::uuid;
  end if;
  if (l->>'startsAt')::timestamptz<(p_statement->>'startsAt')::timestamptz or (l->>'endsAt')::timestamptz>(p_statement->>'endsAt')::timestamptz then raise exception 'cost_outside_source_window'; end if;
  insert into public.platform_provider_cost_lines(statement_id,line_key,organization_id,mux_asset_id,category,starts_at,ends_at,amount_micro_units,source_payload)
  values(key,l->>'key',target_org,l->>'assetId',l->>'category',(l->>'startsAt')::timestamptz,(l->>'endsAt')::timestamptz,(l->>'amountMicroUnits')::bigint,l);
 end loop;
end $$;
revoke all on function public.record_platform_provider_statement(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_platform_provider_statement(uuid,jsonb,jsonb) to service_role;

create or replace function public.grant_platform_capacity_exception(p_id uuid,p_actor_id uuid,p_organization_id uuid,p_resource text,p_seconds numeric,p_reason text,p_expires_at timestamptz) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and is_super_admin and account_status='active') then raise exception 'platform_admin_required'; end if;
 perform 1 from public.organization_billing where organization_id=p_organization_id for update;
 if exists(select 1 from public.platform_quota_exceptions where id=p_id) then
  if not exists(select 1 from public.platform_quota_exceptions where id=p_id and actor_id=p_actor_id and organization_id=p_organization_id and resource=p_resource and quantity_seconds=p_seconds and reason=p_reason and expires_at=p_expires_at) then raise exception 'exception_nonce_changed'; end if;
  return;
 end if;
 if p_resource not in ('library','delivery','admission') or p_seconds<0 or p_seconds>36000000 or p_resource<>'admission' and p_seconds=0 or length(trim(p_reason))<5 or p_expires_at<=now() then raise exception 'invalid_exception'; end if;
 insert into public.platform_quota_exceptions(id,organization_id,actor_id,resource,quantity_seconds,reason,expires_at) values(p_id,p_organization_id,p_actor_id,p_resource,p_seconds,p_reason,p_expires_at);
 if p_resource='delivery' then
  insert into public.platform_delivery_packs(organization_id,source_id,starts_at,expires_at,granted_seconds,paid_cents,granted_by,reason,offer_snapshot)
  values(p_organization_id,'exception:'||p_id::text,now(),p_expires_at,p_seconds,null,p_actor_id,p_reason,jsonb_build_object('type','audited_exception','exceptionId',p_id));
  perform public.rebuild_platform_usage(p_organization_id);
 end if;
end $$;
revoke all on function public.grant_platform_capacity_exception(uuid,uuid,uuid,text,numeric,text,timestamptz) from public,anon,authenticated;
grant execute on function public.grant_platform_capacity_exception(uuid,uuid,uuid,text,numeric,text,timestamptz) to service_role;

create or replace function public.fulfil_platform_delivery_payment(p_operation_id uuid,p_confirmed_at timestamptz,p_source_id text,p_snapshot jsonb,p_refunds jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.platform_billing_operations; r jsonb;
begin
 select * into o from public.platform_billing_operations where id=p_operation_id;
 if o.kind is distinct from 'delivery_pack' or jsonb_typeof(p_refunds)<>'array' then raise exception 'invalid_pack_payment'; end if;
 perform 1 from public.organization_billing where organization_id=o.organization_id for update;
 select * into o from public.platform_billing_operations where id=p_operation_id for update;
 perform public.apply_platform_capacity_payment(p_operation_id,null,null,null,p_confirmed_at,p_source_id);
 update public.platform_delivery_packs set provider_payment_snapshot=p_snapshot where source_id=p_source_id and organization_id=o.organization_id;
 for r in select value from jsonb_array_elements(p_refunds) loop
  perform public.refund_platform_delivery_pack(p_source_id=>p_source_id,p_refund_id=>(r->>'id'),p_refund_cents=>(r->>'amount')::integer,p_refunded_at=>(r->>'created')::timestamptz);
 end loop;
end $$;
revoke all on function public.fulfil_platform_delivery_payment(uuid,timestamptz,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.fulfil_platform_delivery_payment(uuid,timestamptz,text,jsonb,jsonb) to service_role;

create or replace function public.platform_recent_delivery_estimate(p_organization_id uuid,p_start timestamptz,p_end timestamptz) returns numeric language sql stable security definer set search_path=public,pg_temp as $$
 select sum(e.estimated_seconds) from public.platform_playback_estimates e
 join public.platform_playback_sessions ps on ps.id=e.session_id and ps.organization_id=e.organization_id
 left join public.mux_asset_ledger l on l.video_asset_id=ps.video_asset_id and l.organization_id=e.organization_id
 where e.organization_id=p_organization_id and e.starts_at>=p_start and e.starts_at<p_end
 and not exists(select 1 from public.mux_usage_imports i where i.environment=l.environment and i.starts_at=e.starts_at and i.status='complete');
$$;
revoke all on function public.platform_recent_delivery_estimate(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.platform_recent_delivery_estimate(uuid,timestamptz,timestamptz) to service_role;
