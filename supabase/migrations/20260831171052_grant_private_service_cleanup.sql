-- Server maintenance and E2E teardown need to remove private historical rows.
-- before deleting their referenced organizations/users. Browser roles remain
-- fully revoked and no application action exposes this privilege.
grant delete on table public.organization_referral_codes to service_role;
grant delete on table public.organization_referrals to service_role;
grant delete on table public.stripe_platform_webhook_events to service_role;
grant delete on table public.support_impersonation_sessions to service_role;
