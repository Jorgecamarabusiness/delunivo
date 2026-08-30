-- Manual rollback for 20260830210751_platform_commercial_controls.sql.
-- WARNING: commercial overrides and the editable platform price are lost.

drop index if exists public.organization_billing_access_expires_at_idx;

alter table public.organization_billing
  drop constraint if exists organization_billing_trial_expiry_check,
  drop column if exists updated_at,
  drop column if exists commercial_note,
  drop column if exists stripe_coupon_id,
  drop column if exists discount_duration,
  drop column if exists discount_percent,
  drop column if exists access_expires_at,
  drop column if exists access_mode,
  alter column platform_subscription_status set default 'trialing';

drop table if exists public.platform_settings;
