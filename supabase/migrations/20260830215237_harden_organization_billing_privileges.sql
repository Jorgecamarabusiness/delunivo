-- RLS already blocks commercial writes from clients; remove the underlying
-- table privileges too so protection does not depend on one layer.
revoke insert, update, delete, truncate, references, trigger
  on table public.organization_billing from authenticated;

-- The function only reads columns granted to authenticated admins and relies
-- on organization_billing RLS, so elevated privileges are unnecessary.
alter function public.has_org_platform_access(uuid) security invoker;
