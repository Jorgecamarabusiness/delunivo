-- DESTRUCTIVE: removes affiliate attribution, audit history, and discount state.
drop function if exists public.claim_stripe_platform_webhook_event(text, text);
drop function if exists public.apply_stripe_affiliate_billing_event(text, uuid, text, timestamptz, integer);
drop function if exists public.refresh_organization_effective_discount(uuid);
drop function if exists public.attach_organization_referral(text, uuid, uuid);
drop trigger if exists validate_organization_referral_scope_before_write
  on public.organization_referrals;
drop function if exists public.validate_organization_referral_scope();
drop trigger if exists validate_referral_code_creator_before_write
  on public.organization_referral_codes;
drop function if exists public.validate_referral_code_creator();
drop trigger if exists touch_stripe_platform_webhook_events_before_update
  on public.stripe_platform_webhook_events;
drop trigger if exists touch_organization_referrals_before_update
  on public.organization_referrals;
drop trigger if exists touch_organization_referral_codes_before_update
  on public.organization_referral_codes;
drop function if exists public.touch_affiliate_row();
drop table if exists public.stripe_platform_webhook_events;
drop table if exists public.organization_referrals;
drop table if exists public.organization_referral_codes;
alter table public.organization_billing
  drop column if exists manual_discount_remaining_payments,
  drop column if exists referral_welcome_remaining_payments,
  drop column if exists effective_discount_percent,
  drop column if exists affiliate_reward_percent,
  drop column if exists affiliate_discount_cap_percent;
