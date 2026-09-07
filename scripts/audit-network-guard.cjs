/* Sólo para el proceso Next de auditoría: impide que un provider use fetch fuera
 * del mock loopback. El navegador se controla además desde harness.ts. */
const nativeFetch = globalThis.fetch;
const allowed = hostname => ["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname);
globalThis.fetch = async function auditLocalFetch(input, init) {
  const raw = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
  const url = new URL(raw);
  if (!allowed(url.hostname)) {
    throw new Error(`audit network guard blocked outbound request to ${url.origin}`);
  }
  return nativeFetch(input, init);
};

// Stripe and other SDKs can use node:http directly instead of fetch.
for (const protocol of ["http", "https"]) {
  const transport = process.getBuiltinModule(protocol);
  for (const method of ["request", "get"]) {
    const original = transport[method];
    transport[method] = function (...args) {
      const first = args[0];
      const hostname = typeof first === "string" || first instanceof URL
        ? new URL(first).hostname
        : first?.hostname || (first?.host || "localhost").replace(/:\d+$/, "");
      if (!allowed(hostname)) throw new Error("audit network guard blocked an external SDK request");
      return original.apply(this, args);
    };
  }
}
