create table public.platform_settings (
  id boolean primary key default true check (id),
  monthly_price_cents integer not null default 3000
    check (monthly_price_cents between 100 and 1000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_settings (id, monthly_price_cents)
values (true, 3000)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

grant select on public.platform_settings to anon, authenticated;
grant update (monthly_price_cents, updated_at, updated_by)
  on public.platform_settings to authenticated;

create policy platform_settings_public_read
on public.platform_settings
for select
to anon, authenticated
using (true);

create policy platform_settings_super_admin_update
on public.platform_settings
for update
to authenticated
using ((select public.is_super_admin()))
with check ((select public.is_super_admin()));

alter table public.organization_billing
  alter column platform_subscription_status set default 'canceled',
  add column access_mode text not null default 'standard'
    check (access_mode in ('standard', 'complimentary', 'trial')),
  add column access_expires_at timestamptz,
  add column discount_percent smallint not null default 0
    check (discount_percent between 0 and 100),
  add column discount_duration text not null default 'once'
    check (discount_duration in ('once', 'forever')),
  add column stripe_coupon_id text,
  add column commercial_note text
    check (commercial_note is null or char_length(commercial_note) <= 1000),
  add column updated_at timestamptz not null default now(),
  add constraint organization_billing_trial_expiry_check
    check (access_mode <> 'trial' or access_expires_at is not null);

create index organization_billing_access_expires_at_idx
  on public.organization_billing (access_expires_at)
  where access_expires_at is not null;
