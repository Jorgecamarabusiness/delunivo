drop function if exists public.bind_support_impersonation_auth_session(text, uuid, uuid);
alter table public.support_impersonation_sessions
  drop column if exists target_auth_session_id;
