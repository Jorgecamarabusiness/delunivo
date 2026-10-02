-- Operational rollback, deliberately preserves accepted offers, invoices and usage.
-- Execute only as part of an explicitly approved production recovery.
-- Roll back application code first or disable PLATFORM_PLANS_ENABLED; do not drop
-- any ledger after accepting payments. Reconcile paid provider operations before
-- re-enabling enforcement. Existing access and historical contracts are preserved.
begin;
update public.organization_billing set quota_mode='observe';
commit;
