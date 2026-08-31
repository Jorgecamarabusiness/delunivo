revoke all on function public.apply_platform_billing_status_event(
  text, text, text, timestamptz
) from service_role;
revoke all on function public.apply_platform_subscription_checkout_event(
  uuid, text, text, timestamptz
) from service_role;
drop function if exists public.apply_platform_subscription_checkout_event(
  uuid, text, text, timestamptz
);
drop function if exists public.apply_platform_billing_status_event(
  text, text, text, timestamptz
);
alter table public.organization_billing
  drop column if exists platform_billing_last_event_at;
