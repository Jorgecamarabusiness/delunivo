import { readFileSync } from "node:fs";

export const auditMigrations = [
  "20260906213000_require_ready_mux_assets",
  "20260906220156_account_lifecycle_and_free_access",
  "20260907083000_invitation_bounds",
  "20260907084000_retention_and_upload_reservations",
  "20260907094500_recover_incomplete_video_reservations",
  "20260907100000_durable_course_confirmation",
  "20260907101500_preserve_encoded_school_media",
];

// The same transaction is rehearsed on the restored private snapshot and applied
// through the migration API. Only versioned SQL is included; no production data.
export function auditMigrationBundle() {
  const sql = ["begin; set local lock_timeout='10s'; set local statement_timeout='120s';",
    "lock table public.stripe_checkout_attempts in share row exclusive mode;",
    `do $preflight$ begin
      if (select count(*) from supabase_migrations.schema_migrations)<>21
        or (select max(version) from supabase_migrations.schema_migrations)<>'20260902124822'
        then raise exception 'unexpected_migration_baseline'; end if;
      if exists(select 1 from public.stripe_checkout_attempts where checkout_kind='course_purchase' and status in ('creating','open'))
        then raise exception 'active_course_checkout_requires_review'; end if;
    end $preflight$;`];
  for (const name of auditMigrations) {
    const original = readFileSync(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), "utf8");
    // The first historical file owns a transaction. The rollout owns the outer
    // transaction, so strip only standalone SQL transaction delimiters.
    const body = original.replace(/^(?:begin|commit);\s*$/gim, "");
    sql.push(body);
    const version = name.slice(0, 14), title = name.slice(15);
    sql.push(`insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${title}',array['${original.replaceAll("'", "''")}']);`);
  }
  sql.push(`do $verify$ begin
    if (select count(*) from supabase_migrations.schema_migrations)<>28 then raise exception 'incomplete_migration_bundle'; end if;
    if exists(select 1 from public.stripe_checkout_attempts where checkout_kind='course_purchase' and status in ('creating','open'))
      then raise exception 'course_checkout_created_during_rollout'; end if;
    if exists(select 1 from public.profiles where account_status<>'active') then raise exception 'unexpected_account_status'; end if;
  end $verify$; commit;`);
  return sql.join("\n");
}
