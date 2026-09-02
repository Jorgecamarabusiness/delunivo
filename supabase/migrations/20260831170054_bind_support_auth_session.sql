-- Bind audit rows to the real Supabase Auth session.
alter table public.support_impersonation_sessions
  add column target_auth_session_id uuid unique;

create or replace function public.bind_support_impersonation_auth_session(
  p_token_hash text,
  p_target_auth_session_id uuid,
  p_target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_target_auth_session_id is null or not exists (
    select 1
    from auth.sessions session_row
    where session_row.id = p_target_auth_session_id
      and session_row.user_id = p_target_user_id
  ) then
    raise exception 'Target Auth session does not belong to the target user';
  end if;

  update public.support_impersonation_sessions
  set target_auth_session_id = p_target_auth_session_id
  where token_hash = p_token_hash
    and target_user_id = p_target_user_id
    and status = 'active'
    and expires_at > now()
    and target_auth_session_id is null;

  return found;
end;
$$;

revoke all on function public.bind_support_impersonation_auth_session(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bind_support_impersonation_auth_session(text, uuid, uuid)
  to service_role;
