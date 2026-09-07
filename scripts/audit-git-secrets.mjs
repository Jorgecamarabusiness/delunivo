// Heuristic local scan: reports locations/categories only, never matched values.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const objects = execFileSync("git", ["rev-list", "--objects", "--all"], { encoding: "utf8" }).trim().split("\n");
const paths = new Map(objects.map((line) => [line.slice(0, 40), line.slice(41)]));
const raw = execFileSync("git", ["cat-file", "--batch"], { input: [...paths.keys()].join("\n") + "\n", maxBuffer: 128 * 1024 * 1024 });
const findings = [];
let blobs = 0;
function inspect(text, location) {
  const patterns = [
    ["stripe-secret", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/],
    ["webhook-secret", /\bwhsec_[A-Za-z0-9]{20,}\b/],
    ["supabase-secret", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
    ["resend-secret", /\bre_[A-Za-z0-9]{24,}\b/],
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["github-token", /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}\b/],
  ];
  for (const [category, pattern] of patterns) {
    if (pattern.test(text)) findings.push({ location, category });
  }
  for (const jwt of text.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(jwt[1], "base64url").toString()).role === "service_role") findings.push({ location, category: "service-role-jwt" });
    } catch { /* Not a JWT. */ }
  }
}
let offset = 0;
while (offset < raw.length) {
  const end = raw.indexOf(10, offset);
  const [oid, kind, bytes] = raw.subarray(offset, end).toString().split(" ");
  const size = Number(bytes);
  if (!Number.isFinite(size)) throw new Error("Unexpected git object header");
  offset = end + 1;
  if (kind === "blob") { blobs++; inspect(raw.subarray(offset, offset + size).toString(), `history:${oid.slice(0, 12)}:${paths.get(oid)}`); }
  offset += size + 1;
}
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
for (const file of files) { try { inspect(readFileSync(file, "utf8"), `worktree:${file}`); } catch { /* Removed file. */ } }
console.log(JSON.stringify({ commits: Number(execFileSync("git", ["rev-list", "--all", "--count"], { encoding: "utf8" })), blobs, worktreeFiles: files.length, findings, limitation: "Heuristic known formats only; does not prove the absence of secrets or scan ignored environment files." }, null, 2));
