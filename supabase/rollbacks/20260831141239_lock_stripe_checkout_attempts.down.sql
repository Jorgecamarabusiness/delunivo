-- DESTRUCTIVE: permanently removes pending/completed Checkout coordination
-- history. Do not run while the matching application code is deployed.
drop table if exists public.stripe_checkout_attempts;
