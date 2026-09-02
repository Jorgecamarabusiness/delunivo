-- Preserve the newest Stripe billing state when webhooks from the same
-- subscription arrive out of order.

alter table public.organization_billing
  add column platform_billing_last_event_at timestamptz;

create or replace function public.apply_platform_billing_status_event(
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_event_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  affected_organization_id uuid;
begin
  if p_status not in ('active', 'past_due', 'canceled') then
    raise exception 'Unsupported platform billing status';
  end if;
  if p_customer_id is null or p_subscription_id is null or p_event_at is null then
    raise exception 'Incomplete platform billing event';
  end if;

  update public.organization_billing
  set platform_subscription_status = p_status,
      platform_billing_last_event_at = p_event_at,
      updated_at = now()
  where platform_stripe_customer_id = p_customer_id
    and platform_subscription_id = p_subscription_id
    and (
      platform_billing_last_event_at is null
      or p_event_at >= platform_billing_last_event_at
    )
  returning organization_id into affected_organization_id;

  return affected_organization_id;
end;
$$;

revoke all on function public.apply_platform_billing_status_event(
  text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_platform_billing_status_event(
  text, text, text, timestamptz
) to service_role;

create or replace function public.apply_platform_subscription_checkout_event(
  p_organization_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_event_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_organization_id is null or p_customer_id is null
     or p_subscription_id is null or p_event_at is null then
    raise exception 'Incomplete platform checkout event';
  end if;

  update public.organization_billing
  set platform_stripe_customer_id = p_customer_id,
      platform_subscription_id = p_subscription_id,
      platform_subscription_status = 'active',
      platform_billing_last_event_at = p_event_at,
      updated_at = now()
  where organization_id = p_organization_id
    and (
      platform_subscription_id is null
      or platform_subscription_id = p_subscription_id
      or platform_subscription_status = 'canceled'
    )
    and (
      platform_billing_last_event_at is null
      or p_event_at >= platform_billing_last_event_at
    );

  return found;
end;
$$;

revoke all on function public.apply_platform_subscription_checkout_event(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_platform_subscription_checkout_event(
  uuid, text, text, timestamptz
) to service_role;
