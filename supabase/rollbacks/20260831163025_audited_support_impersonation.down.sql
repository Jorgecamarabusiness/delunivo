-- DESTRUCTIVE: permanently removes all support impersonation audit history.
drop function if exists public.close_support_impersonation_audit(text, text, uuid, text);
drop function if exists public.start_support_impersonation_audit(uuid, uuid, text, text, text, timestamptz, inet, text);
drop table if exists public.support_impersonation_sessions;
