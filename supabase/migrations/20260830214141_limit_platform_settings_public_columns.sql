-- Public pages only need the singleton key and its current price. Keep audit
-- metadata private even though the table itself has a public read policy.
revoke select on table public.platform_settings from anon, authenticated;
grant select (id, monthly_price_cents)
  on table public.platform_settings to anon, authenticated;
