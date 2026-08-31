-- Affiliate attribution and server-only Stripe discount coordination.
-- The application always sends Stripe one computed coupon so percentage
-- components add exactly and the configured cap cannot be bypassed by stacking.

alter table public.organization_billing
  add column affiliate_discount_cap_percent smallint not null default 50
    check (affiliate_discount_cap_percent between 0 and 100),
  add column affiliate_reward_percent smallint not null default 10
    check (affiliate_reward_percent between 0 and 50),
  add column effective_discount_percent smallint not null default 0
    check (effective_discount_percent between 0 and 100),
  add column referral_welcome_remaining_payments smallint not null default 0
    check (referral_welcome_remaining_payments between 0 and 3),
  add column manual_discount_remaining_payments smallint not null default 0
    check (manual_discount_remaining_payments between 0 and 1);

create table public.organization_referral_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique
    references public.organizations(id) on delete restrict,
  code text not null unique
    check (code ~ '^[A-Za-z0-9_-]{22,64}$'),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null
    references public.organization_referral_codes(id) on delete restrict,
  referrer_organization_id uuid not null
    references public.organizations(id) on delete restrict,
  referred_organization_id uuid not null unique
    references public.organizations(id) on delete restrict,
  referrer_owner_id uuid not null references auth.users(id) on delete restrict,
  referred_owner_id uuid not null unique references auth.users(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'inactive')),
  first_paid_at timestamptz,
  last_paid_at timestamptz,
  last_billing_event_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_referrals_distinct_organizations
    check (referrer_organization_id <> referred_organization_id),
  constraint organization_referrals_distinct_people
    check (referrer_owner_id <> referred_owner_id),
  constraint organization_referrals_payment_shape check (
    (status = 'pending' and first_paid_at is null)
    or (status in ('active', 'inactive') and first_paid_at is not null)
  )
);

create index organization_referrals_referrer_status_idx
  on public.organization_referrals (referrer_organization_id, status);

create index organization_referrals_referred_status_idx
  on public.organization_referrals (referred_organization_id, status);

create table public.stripe_platform_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  last_error text,
  domain_applied_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index stripe_platform_webhook_events_retry_idx
  on public.stripe_platform_webhook_events (status, updated_at)
  where status <> 'completed';

alter table public.organization_referral_codes enable row level security;
alter table public.organization_referrals enable row level security;
alter table public.stripe_platform_webhook_events enable row level security;

-- Referral codes and attribution are deliberately server-only. Public links
-- are resolved by a route handler; clients cannot inspect or mutate the tables.
revoke all on table public.organization_referral_codes from public, anon, authenticated;
revoke all on table public.organization_referrals from public, anon, authenticated;
revoke all on table public.stripe_platform_webhook_events from public, anon, authenticated;
grant select, insert, update on table public.organization_referral_codes to service_role;
grant select, insert, update on table public.organization_referrals to service_role;
grant select, insert, update on table public.stripe_platform_webhook_events to service_role;

create or replace function public.touch_affiliate_row()
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

create trigger touch_organization_referral_codes_before_update
before update on public.organization_referral_codes
for each row execute function public.touch_affiliate_row();

create trigger touch_organization_referrals_before_update
before update on public.organization_referrals
for each row execute function public.touch_affiliate_row();

create trigger touch_stripe_platform_webhook_events_before_update
before update on public.stripe_platform_webhook_events
for each row execute function public.touch_affiliate_row();

create or replace function public.validate_referral_code_creator()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.organization_admins oa
    where oa.organization_id = new.organization_id
      and oa.user_id = new.created_by
  ) then
    raise exception 'Referral code creator is not an organization administrator';
  end if;

  return new;
end;
$$;

create trigger validate_referral_code_creator_before_write
before insert or update of organization_id, created_by
on public.organization_referral_codes
for each row execute function public.validate_referral_code_creator();

create or replace function public.validate_organization_referral_scope()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.organization_referral_codes rc
    join public.organizations referrer on referrer.id = rc.organization_id
    join public.organizations referred on referred.id = new.referred_organization_id
    where rc.id = new.referral_code_id
      and rc.organization_id = new.referrer_organization_id
      and referrer.owner_id = new.referrer_owner_id
      and referred.owner_id = new.referred_owner_id
  ) then
    raise exception 'Referral scope does not match its organizations and owners';
  end if;

  if exists (
    select 1
    from public.organization_billing
    where organization_id = new.referred_organization_id
      and (
        platform_stripe_customer_id is not null
        or platform_subscription_id is not null
        or platform_subscription_status in ('trialing', 'active', 'past_due')
      )
  ) then
    raise exception 'Referral attribution is only allowed before billing starts';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = new.referred_organization_id
      and created_at >= now() - interval '15 minutes'
  ) then
    raise exception 'Referral attribution window has expired';
  end if;

  return new;
end;
$$;

create or replace function public.refresh_organization_effective_discount(
  p_organization_id uuid
)
returns smallint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  billing public.organization_billing%rowtype;
  active_referrals integer;
  manual_component integer;
  welcome_component integer;
  computed smallint;
begin
  select *
  into billing
  from public.organization_billing
  where organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Organization billing record not found';
  end if;

  select count(*)
  into active_referrals
  from public.organization_referrals
  where referrer_organization_id = p_organization_id
    and status = 'active';

  manual_component := case
    when billing.discount_duration = 'forever' then billing.discount_percent
    when billing.manual_discount_remaining_payments > 0 then billing.discount_percent
    else 0
  end;

  welcome_component := case
    when billing.referral_welcome_remaining_payments > 0 then 10
    else 0
  end;

  computed := least(
    billing.affiliate_discount_cap_percent,
    manual_component
      + welcome_component
      + (active_referrals * billing.affiliate_reward_percent)
  )::smallint;

  update public.organization_billing
  set effective_discount_percent = computed,
      updated_at = now()
  where organization_id = p_organization_id;

  return computed;
end;
$$;

create or replace function public.apply_stripe_affiliate_billing_event(
  p_event_id text,
  p_organization_id uuid,
  p_event_kind text,
  p_event_at timestamptz,
  p_amount_paid integer default 0
)
returns uuid[]
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  event_row public.stripe_platform_webhook_events%rowtype;
  referrer_id uuid;
  affected uuid[];
begin
  if p_event_kind not in ('invoice_paid', 'payment_failed', 'subscription_deleted') then
    raise exception 'Unsupported affiliate billing event';
  end if;

  if p_event_at is null or p_amount_paid < 0 then
    raise exception 'Affiliate billing event has invalid payment data';
  end if;

  select *
  into event_row
  from public.stripe_platform_webhook_events
  where event_id = p_event_id
  for update;

  if not found or event_row.status <> 'processing' then
    raise exception 'Stripe platform event is not claimed';
  end if;

  select referrer_organization_id
  into referrer_id
  from public.organization_referrals
  where referred_organization_id = p_organization_id
  for update;

  if event_row.domain_applied_at is null then
    if p_event_kind = 'invoice_paid' and p_amount_paid > 0 then
      update public.organization_billing
      set referral_welcome_remaining_payments = greatest(
            referral_welcome_remaining_payments - 1,
            0
          ),
          manual_discount_remaining_payments = case
            when discount_duration = 'once'
              then greatest(manual_discount_remaining_payments - 1, 0)
            else manual_discount_remaining_payments
          end,
          updated_at = now()
      where organization_id = p_organization_id;

      update public.organization_referrals
      set status = 'active',
          first_paid_at = coalesce(first_paid_at, p_event_at),
          last_paid_at = greatest(coalesce(last_paid_at, p_event_at), p_event_at),
          last_billing_event_at = p_event_at,
          deactivated_at = null
      where referred_organization_id = p_organization_id
        and p_event_at >= coalesce(
          last_billing_event_at,
          '-infinity'::timestamptz
        );
    elsif p_event_kind in ('payment_failed', 'subscription_deleted') then
      update public.organization_referrals
      set status = case when first_paid_at is null then status else 'inactive' end,
          deactivated_at = case
            when first_paid_at is null then deactivated_at
            else p_event_at
          end,
          last_billing_event_at = p_event_at
      where referred_organization_id = p_organization_id
        and p_event_at >= coalesce(
          last_billing_event_at,
          '-infinity'::timestamptz
        );
    end if;

    update public.stripe_platform_webhook_events
    set domain_applied_at = now()
    where event_id = p_event_id;
  end if;

  perform public.refresh_organization_effective_discount(p_organization_id);

  affected := array[p_organization_id];
  if referrer_id is not null then
    perform public.refresh_organization_effective_discount(referrer_id);
    affected := affected || referrer_id;
  end if;

  return affected;
end;
$$;

create trigger validate_organization_referral_scope_before_write
before insert or update of referral_code_id, referrer_organization_id,
  referred_organization_id, referrer_owner_id, referred_owner_id
on public.organization_referrals
for each row execute function public.validate_organization_referral_scope();

create or replace function public.attach_organization_referral(
  p_code text,
  p_referred_organization_id uuid,
  p_referred_owner_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target_code public.organization_referral_codes%rowtype;
  referrer_owner uuid;
  referral_id uuid;
begin
  select *
  into target_code
  from public.organization_referral_codes
  where code = p_code
    and is_active
  for update;

  if not found then
    raise exception 'Referral code is invalid or inactive';
  end if;

  select owner_id
  into referrer_owner
  from public.organizations
  where id = target_code.organization_id;

  if not exists (
    select 1
    from public.organizations
    where id = p_referred_organization_id
      and owner_id = p_referred_owner_id
  ) then
    raise exception 'Referred organization does not belong to this owner';
  end if;

  if referrer_owner = p_referred_owner_id then
    raise exception 'Self-referrals are not allowed';
  end if;

  insert into public.organization_referrals (
    referral_code_id,
    referrer_organization_id,
    referred_organization_id,
    referrer_owner_id,
    referred_owner_id
  ) values (
    target_code.id,
    target_code.organization_id,
    p_referred_organization_id,
    referrer_owner,
    p_referred_owner_id
  )
  returning id into referral_id;

  update public.organization_billing
  set referral_welcome_remaining_payments = 3,
      updated_at = now()
  where organization_id = p_referred_organization_id;

  if not found then
    raise exception 'Referred organization has no billing record';
  end if;

  perform public.refresh_organization_effective_discount(
    p_referred_organization_id
  );

  return referral_id;
end;
$$;

create or replace function public.claim_stripe_platform_webhook_event(
  p_event_id text,
  p_event_type text
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
  insert into public.stripe_platform_webhook_events (
    event_id,
    event_type
  ) values (
    p_event_id,
    p_event_type
  )
  on conflict (event_id) do nothing;

  if found then
    return 'claimed';
  end if;

  select status, updated_at
  into existing_status, existing_updated_at
  from public.stripe_platform_webhook_events
  where event_id = p_event_id
  for update;

  if existing_status = 'completed' then
    return 'duplicate';
  end if;

  if existing_status = 'processing'
     and existing_updated_at > now() - interval '5 minutes' then
    return 'in_progress';
  end if;

  update public.stripe_platform_webhook_events
  set status = 'processing',
      event_type = p_event_type,
      attempts = attempts + 1,
      last_error = null,
      processed_at = null
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

revoke all on function public.touch_affiliate_row() from public, anon, authenticated;
revoke all on function public.validate_referral_code_creator() from public, anon, authenticated;
revoke all on function public.validate_organization_referral_scope() from public, anon, authenticated;
revoke all on function public.attach_organization_referral(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.refresh_organization_effective_discount(uuid) from public, anon, authenticated;
revoke all on function public.apply_stripe_affiliate_billing_event(text, uuid, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.claim_stripe_platform_webhook_event(text, text) from public, anon, authenticated;
grant execute on function public.attach_organization_referral(text, uuid, uuid) to service_role;
grant execute on function public.refresh_organization_effective_discount(uuid) to service_role;
grant execute on function public.apply_stripe_affiliate_billing_event(text, uuid, text, timestamptz, integer) to service_role;
grant execute on function public.claim_stripe_platform_webhook_event(text, text) to service_role;
