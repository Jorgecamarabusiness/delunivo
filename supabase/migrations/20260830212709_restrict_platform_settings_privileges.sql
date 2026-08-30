-- RLS already blocks unauthorized writes, but explicit grants should expose
-- only the operations the application actually uses.
revoke all on table public.platform_settings from anon, authenticated;

grant select on table public.platform_settings to anon, authenticated;
grant update (monthly_price_cents, updated_at, updated_by)
  on table public.platform_settings to authenticated;

-- Access is always resolved from the organization PK in request time. There
-- is no expiry sweep or query by date, so this index would only add write cost.
drop index if exists public.organization_billing_access_expires_at_idx;
