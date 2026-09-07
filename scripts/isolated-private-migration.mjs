import { execFileSync } from "node:child_process";
import { auditMigrationBundle } from "./audit-migration-bundle.mjs";
import { localSupabase } from "./isolated-supabase.mjs";

try {
  if (process.env.GITHUB_ACTIONS !== "true" || process.platform !== "linux"
    || localSupabase().apiUrl !== "http://127.0.0.1:55471") throw new Error();
  execFileSync("docker", ["exec", "-i", "supabase_db_delunivo-audit", "psql", "-X",
    "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-U", "postgres", "-d", "postgres"],
  { input: auditMigrationBundle(), maxBuffer: 4 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  console.log(JSON.stringify({ privateSnapshotMigration: "verified", transaction: "atomic", migrations: 7, externalMutations: 0 }));
} catch (error) {
  const diagnostic = Buffer.isBuffer(error.stderr) ? error.stderr.toString() : "";
  const sqlstate = diagnostic.match(/(?:SQLSTATE[ :]+|ERROR:\s+)([0-9A-Z]{5})/)?.[1];
  console.error(JSON.stringify({ privateSnapshotMigration: "failed", sqlstate: sqlstate ?? "unavailable" }));
  process.exitCode = 1;
}
