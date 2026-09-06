import { execFileSync } from "node:child_process";

const supabaseCommand = process.env.SUPABASE_CLI || (process.platform === "win32" ? "npx.cmd" : "npx");
const supabaseArgs = process.env.SUPABASE_CLI
  ? ["status", "-o", "env"]
  : ["--yes", "supabase@2.116.0", "status", "-o", "env"];

function parseEnv(output) {
  const values = {};

  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    values[key] = value;
  }

  return values;
}

export function localSupabase() {
  const output = execFileSync(
    supabaseCommand,
    supabaseArgs,
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const status = parseEnv(output);
  const apiUrl = status.API_URL ?? status.SUPABASE_URL;
  const anonKey = status.ANON_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;

  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error("El estado local de Supabase no contiene API_URL, ANON_KEY y SERVICE_ROLE_KEY.");
  }

  const parsed = new URL(apiUrl);
  if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
    throw new Error("Las pruebas aisladas solo admiten una API de loopback.");
  }

  return { apiUrl: parsed.origin, anonKey, serviceRoleKey };
}

export async function requestJson(url, { key, token = key, method = "GET", body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = text;
  try {
    data = text === "" ? null : JSON.parse(text);
  } catch {
    // Storage errors can be text. Callers only expose their HTTP status.
  }
  return { response, data };
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
