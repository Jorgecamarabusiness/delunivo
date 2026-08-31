-- Short-lived, auditable support impersonation. The original super-admin
-- session is encrypted by the application before it is stored here.

create table public.support_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  encrypted_actor_session text not null,
  reason text not null
    check (char_length(trim(reason)) between 5 and 500),
  status text not null default 'active'
    check (status in ('active', 'ended', 'revoked', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete restrict,
  end_reason text check (end_reason is null or char_length(end_reason) <= 500),
  ip_address inet,
  user_agent text check (user_agent is null or char_length(user_agent) <= 1000),
  constraint support_impersonation_distinct_users
    check (actor_user_id <> target_user_id),
  constraint support_impersonation_short_lived check (
    expires_at > started_at
    and expires_at <= started_at + interval '15 minutes'
  ),
  constraint support_impersonation_end_shape check (
    (status = 'active' and ended_at is null)
    or (status <> 'active' and ended_at is not null)
  )
);

create unique index support_impersonation_one_active_actor_idx
  on public.support_impersonation_sessions (actor_user_id)
  where status = 'active';

create index support_impersonation_target_history_idx
  on public.support_impersonation_sessions (target_user_id, started_at desc);

create index support_impersonation_active_expiry_idx
  on public.support_impersonation_sessions (expires_at)
  where status = 'active';

alter table public.support_impersonation_sessions enable row level security;

-- No browser role can read the encrypted original session or audit metadata.
revoke all on table public.support_impersonation_sessions from public, anon, authenticated;
grant select, insert, update on table public.support_impersonation_sessions to service_role;

create or replace function public.start_support_impersonation_audit(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_token_hash text,
  p_encrypted_actor_session text,
  p_reason text,
  p_expires_at timestamptz,
  p_ip_address inet,
  p_user_agent text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  session_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_user_id and is_super_admin
  ) then
    raise exception 'Only a super administrator can start support impersonation';
  end if;

  if exists (
    select 1 from public.profiles
    where id = p_target_user_id and is_super_admin
  ) then
    raise exception 'Super administrators cannot be impersonated';
  end if;

  update public.support_impersonation_sessions
  set status = 'expired',
      ended_at = now(),
      ended_by = p_actor_user_id,
      end_reason = 'Expired before a new support session started'
  where actor_user_id = p_actor_user_id
    and status = 'active'
    and expires_at <= now();

  insert into public.support_impersonation_sessions (
    actor_user_id,
    target_user_id,
    token_hash,
    encrypted_actor_session,
    reason,
    expires_at,
    ip_address,
    user_agent
  ) values (
    p_actor_user_id,
    p_target_user_id,
    p_token_hash,
    p_encrypted_actor_session,
    trim(p_reason),
    p_expires_at,
    p_ip_address,
    p_user_agent
  )
  returning id into session_id;

  return session_id;
end;
$$;

create or replace function public.close_support_impersonation_audit(
  p_token_hash text,
  p_status text,
  p_ended_by uuid,
  p_end_reason text
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  target public.support_impersonation_sessions%rowtype;
begin
  if p_status not in ('ended', 'revoked', 'expired') then
    raise exception 'Unsupported support session end status';
  end if;

  select *
  into target
  from public.support_impersonation_sessions
  where token_hash = p_token_hash
  for update;

  if not found or target.status <> 'active' then
    return false;
  end if;

  if p_ended_by is not null
     and p_ended_by not in (target.actor_user_id, target.target_user_id) then
    raise exception 'Support session can only be ended by its actor or target';
  end if;

  if p_status = 'expired' and target.expires_at > now() then
    raise exception 'Support session has not expired';
  end if;

  update public.support_impersonation_sessions
  set status = p_status,
      ended_at = now(),
      ended_by = p_ended_by,
      end_reason = left(p_end_reason, 500)
  where id = target.id;

  return true;
end;
$$;

revoke all on function public.start_support_impersonation_audit(uuid, uuid, text, text, text, timestamptz, inet, text) from public, anon, authenticated;
revoke all on function public.close_support_impersonation_audit(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.start_support_impersonation_audit(uuid, uuid, text, text, text, timestamptz, inet, text) to service_role;
grant execute on function public.close_support_impersonation_audit(text, text, uuid, text) to service_role;
