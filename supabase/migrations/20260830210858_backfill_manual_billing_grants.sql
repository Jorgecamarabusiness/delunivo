-- Existing organizations marked active without any Stripe subscription were
-- manual grants. Make that explicit so the superadmin panel never presents
-- them as paying customers.
update public.organization_billing
set
  access_mode = 'complimentary',
  commercial_note = coalesce(
    commercial_note,
    'Acceso gratuito anterior al panel comercial'
  ),
  updated_at = now()
where platform_subscription_status = 'active'
  and platform_subscription_id is null;
