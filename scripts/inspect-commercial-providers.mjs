// Read-only provider evidence. Never loads a Supabase client or prints credentials/PII.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import Stripe from 'stripe';
const local = parseEnv(fs.readFileSync('.env.local', 'utf8'));
const production = parseEnv(fs.readFileSync('.env.production.local', 'utf8'));
const report = { inspectedAt: new Date().toISOString() };
for (const [name, env] of [['test', local], ['production-read-only', production]]) {
  const key = env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_(test|live)_/.test(key)) { report[name] = { available: false, reason: key ? "redacted_environment_export" : "missing_key" }; continue; }
  const stripe = new Stripe(key);
  try {
    const rates = await stripe.taxRates.list({ active: true, limit: 100 });
    report[name] = { available: true, keyMode: /^(sk|rk)_test_/.test(key) ? 'test' : /^(sk|rk)_live_/.test(key) ? 'live' : 'unknown',
      taxRates: rates.data.map(r => ({ inclusive: r.inclusive, percentage: r.percentage, country: r.country, jurisdiction: r.jurisdiction, livemode: r.livemode })), hasMore: rates.has_more };
  } catch (error) { report[name] = { available: false, errorType: error.type ?? 'provider_error', status: error.statusCode ?? null }; }
}
if (production.MUX_TOKEN_ID && production.MUX_TOKEN_SECRET && !/sensitive|redacted/i.test(production.MUX_TOKEN_ID + production.MUX_TOKEN_SECRET)) {
  const headers = { Authorization: `Basic ${Buffer.from(`${production.MUX_TOKEN_ID}:${production.MUX_TOKEN_SECRET}`).toString('base64')}` };
  try {
    const response = await fetch('https://api.mux.com/system/v1/whoami', { headers });
    const body = await response.json();
    const data = body.data ?? {};
    report.mux = { status: response.status, environmentId: data.environment?.id ?? null, environmentName: data.environment?.name ?? null, tokenType: data.type ?? null };
  } catch { report.mux = { available: false }; }
} else { report.mux = { available: false, reason: "missing_or_redacted_environment_export" }; }

fs.mkdirSync('docs/evidencias/plans-2026-10-01', { recursive: true });
fs.writeFileSync('docs/evidencias/plans-2026-10-01/provider-read-only.json', JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report, null, 2));
