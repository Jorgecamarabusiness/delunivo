-- Server-only coordination for Stripe Checkout creation. This prevents two
-- concurrent requests from creating independently chargeable sessions.
create table public.stripe_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  checkout_kind text not null
    check (checkout_kind in ('course_purchase', 'platform_subscription')),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  user_id uuid not null
    references public.profiles(id) on delete restrict,
  course_id uuid
    references public.courses(id) on delete restrict,
  stripe_account_id text,
  stripe_session_id text unique,
  stripe_session_url text,
  stripe_params jsonb not null,
  expected_amount_total integer,
  expected_currency text not null default 'eur',
  status text not null default 'creating'
    check (status in ('creating', 'open', 'completed', 'expired', 'failed')),
  expires_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_checkout_attempts_shape_check check (
    (
      checkout_kind = 'course_purchase'
      and course_id is not null
      and stripe_account_id is not null
      and expected_amount_total is not null
      and expected_amount_total >= 0
    )
    or
    (
      checkout_kind = 'platform_subscription'
      and course_id is null
      and stripe_account_id is null
      and expected_amount_total is null
    )
  ),
  constraint stripe_checkout_attempts_currency_check check (
    expected_currency ~ '^[a-z]{3}$'
  ),
  constraint stripe_checkout_attempts_session_shape_check check (
    (stripe_session_id is null and stripe_session_url is null)
    or
    (stripe_session_id is not null and stripe_session_url is not null)
  )
);

create unique index stripe_checkout_attempts_active_course_idx
  on public.stripe_checkout_attempts (user_id, course_id)
  where checkout_kind = 'course_purchase'
    and status in ('creating', 'open');

create unique index stripe_checkout_attempts_active_platform_idx
  on public.stripe_checkout_attempts (organization_id)
  where checkout_kind = 'platform_subscription'
    and status in ('creating', 'open');

create index stripe_checkout_attempts_organization_id_idx
  on public.stripe_checkout_attempts (organization_id);

create index stripe_checkout_attempts_user_id_idx
  on public.stripe_checkout_attempts (user_id);

create index stripe_checkout_attempts_course_id_idx
  on public.stripe_checkout_attempts (course_id)
  where course_id is not null;

alter table public.stripe_checkout_attempts enable row level security;

-- No anon/authenticated policies by design: only server code using the
-- service role may coordinate or inspect checkout attempts and their URLs.
revoke all on table public.stripe_checkout_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.stripe_checkout_attempts to service_role;
