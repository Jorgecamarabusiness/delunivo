// Run only on an ephemeral CI Supabase stack. Never receives production keys.
// Snapshot/key arrive as temporary repository secrets, not files or artifacts.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

let temporary;
let phase = "environment";
try {
  if (process.env.GITHUB_ACTIONS !== "true" || process.platform !== "linux") throw new Error();
  const secrets = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith("DELUNIVO_RESTORE_")));
  for (const key of Object.keys(secrets)) delete process.env[key];
  const { localSupabase } = await import("./isolated-supabase.mjs");
  const local = localSupabase();
  if (local.apiUrl !== "http://127.0.0.1:55471") throw new Error();
  const encoded = [1,2,3,4,5,6].map(n => secrets[`DELUNIVO_RESTORE_PART_${n}`] ?? "").join("");
  const ciphertext = Buffer.from(encoded, "base64");
  if (createHash("sha256").update(ciphertext).digest("hex") !== secrets.DELUNIVO_RESTORE_SHA256) throw new Error();
  temporary = mkdtempSync(join(tmpdir(), "delunivo-private-restore-"));
  phase = "decrypt";
  execFileSync("gpg", ["--homedir", temporary, "--batch", "--import"], { input: secrets.DELUNIVO_RESTORE_KEY, stdio: ["pipe", "pipe", "pipe"] });
  const plaintext = execFileSync("gpg", ["--homedir", temporary, "--batch", "--decrypt"], { input: ciphertext, maxBuffer: 30 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  const snapshot = JSON.parse(plaintext.toString("utf8"));
  if (snapshot.format !== 1 || snapshot.project_ref !== "jgxqdzmmeveksseflyst" || !Array.isArray(snapshot.tables)) throw new Error();
  if (snapshot.tables.some(t => !["public", "auth", "storage"].includes(t.schema))) throw new Error();
  // Source manifest captured with the encrypted snapshot; names only, never records.
  const expected = {
    auth: "audit_log_entries custom_oauth_providers flow_state identities instances mfa_amr_claims mfa_challenges mfa_factors oauth_authorizations oauth_client_states oauth_clients oauth_consents one_time_tokens refresh_tokens saml_providers saml_relay_states schema_migrations sessions sso_domains sso_providers users webauthn_challenges webauthn_credentials",
    public: "admin_emails courses invitation_courses invitations lessons mux_deletion_jobs mux_webhook_events organization_admins organization_billing organization_integrations organization_referral_codes organization_referrals organization_students organizations platform_settings profiles purchases sections stripe_checkout_attempts stripe_platform_webhook_events student_course_access support_impersonation_sessions verification_codes video_assets video_views",
    storage: "buckets buckets_analytics buckets_vectors migrations objects s3_multipart_uploads s3_multipart_uploads_parts vector_indexes",
  };
  const expectedNames = Object.entries(expected).flatMap(([schema,names]) => names.split(" ").map(name => `${schema}.${name}`)).sort();
  if (JSON.stringify(snapshot.tables.map(t => `${t.schema}.${t.name}`).sort()) !== JSON.stringify(expectedNames)) throw new Error();
  const tables = snapshot.tables.filter(t => !((t.schema === "auth" && t.name === "schema_migrations") || (t.schema === "storage" && t.name === "migrations")));
  phase = "schema_compatibility";
  const catalog = JSON.parse(execFileSync("docker", ["exec", "supabase_db_delunivo-audit", "psql", "-U", "postgres", "-d", "postgres", "-At", "-c",
    "select json_agg(json_build_object('schema',table_schema,'name',table_name,'column',column_name)) from information_schema.columns where table_schema in ('public','auth','storage')"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  const missing = tables.flatMap(t => t.columns.filter(c => !catalog.some(a => a.schema === t.schema && a.name === t.name && a.column === c)).map(c => `${t.schema}.${t.name}.${c}`));
  if (missing.length) {
    // Schema identifiers from the allowlisted manifest are safe; never print rows.
    console.error(JSON.stringify({ missingSchemaColumns: missing }));
    throw new Error();
  }
  const ident = x => { if (!/^[a-z_][a-z0-9_]*$/.test(x)) throw new Error(); return `"${x}"`; };
  const qualified = t => `${ident(t.schema)}.${ident(t.name)}`;
  const statements = ["begin; set local session_replication_role=replica;", `truncate ${tables.map(qualified).join(",")} restart identity cascade;`];
  for (const table of tables) {
    if (!table.rows.length) continue;
    const json = JSON.stringify(table.rows);
    let delimiter;
    do { delimiter = `$backup_${randomBytes(12).toString("hex")}$`; } while (json.includes(delimiter));
    const columns = table.columns.map(ident).join(",");
    statements.push(`insert into ${qualified(table)}(${columns}) overriding system value select ${columns} from jsonb_populate_recordset(null::${qualified(table)},${delimiter}${json}${delimiter}::jsonb);`);
  }
  statements.push("set local session_replication_role=origin;");
  statements.push(`do $sequences$ declare col record; seq text; maximum bigint; begin
    for col in select table_schema,table_name,column_name from information_schema.columns where table_schema in ('public','auth','storage') loop
      seq:=pg_get_serial_sequence(format('%I.%I',col.table_schema,col.table_name),col.column_name);
      if seq is not null then
        execute format('select max(%I) from %I.%I',col.column_name,col.table_schema,col.table_name) into maximum;
        perform setval(seq::regclass,coalesce(maximum,1),maximum is not null);
      end if;
    end loop; end $sequences$;`);
  for (const table of tables) statements.push(`do $check$ begin if (select count(*) from ${qualified(table)})<>${table.rows.length} then raise exception 'snapshot_row_count_mismatch'; end if; end $check$;`);
  statements.push(`do $foreign_keys$
  declare fk record; predicates text; nonnull text; missing bigint;
  begin
    for fk in select * from pg_constraint where contype='f' and connamespace in ('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace) loop
      select string_agg(format('r.%I=s.%I',ra.attname,sa.attname),' and '), string_agg(format('s.%I is not null',sa.attname),' and ')
      into predicates,nonnull from unnest(fk.conkey,fk.confkey) keys(skey,rkey)
      join pg_attribute sa on sa.attrelid=fk.conrelid and sa.attnum=keys.skey
      join pg_attribute ra on ra.attrelid=fk.confrelid and ra.attnum=keys.rkey;
      execute format('select count(*) from %s s where %s and not exists(select 1 from %s r where %s)',fk.conrelid::regclass,nonnull,fk.confrelid::regclass,predicates) into missing;
      if missing<>0 then raise exception 'snapshot_foreign_key_mismatch'; end if;
    end loop;
  end $foreign_keys$;
  commit; select 'private_snapshot_restored_and_foreign_keys_verified' as result;`);
  const file = join(temporary, "restore.sql");
  writeFileSync(file, statements.join("\n"), { mode: 0o600 });
  phase = "restore_and_constraints";
  try {
    execFileSync("docker", ["exec", "-i", "supabase_db_delunivo-audit", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-U", "postgres", "-d", "postgres"], { input: statements.join("\n"), maxBuffer: 4 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) {
    const diagnostic = Buffer.isBuffer(error.stderr) ? error.stderr.toString() : "";
    const sqlstate = diagnostic.match(/(?:SQLSTATE[ :]+|ERROR:\s+)([0-9A-Z]{5})/)?.[1];
    console.error(JSON.stringify({ sqlstate: sqlstate ?? "unavailable" }));
    throw new Error();
  }
  console.log(JSON.stringify({ restored: "database_and_metadata", tables: tables.length, rows: tables.reduce((n,t) => n + t.rows.length, 0), snapshotSha256: secrets.DELUNIVO_RESTORE_SHA256, foreignKeys: "verified", sequences: "advanced", externalMutations: 0 }));
} catch {
  // Never log a caught command error: it may embed SQL, passwords or user rows.
  console.error(`Private restore failed at ${phase}; no private records emitted.`);
  process.exitCode = 1;
} finally {
  if (temporary?.startsWith(join(tmpdir(), "delunivo-private-restore-"))) rmSync(temporary, { recursive: true, force: true });
}
