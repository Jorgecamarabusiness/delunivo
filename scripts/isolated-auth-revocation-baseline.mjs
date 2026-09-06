import { assert, localSupabase, requestJson } from "./isolated-supabase.mjs";

const { apiUrl, anonKey } = localSupabase();
const email = `auth-revocation-${Date.now()}-${process.pid}@synthetic.invalid`;
const password = "Synthetic-pass-123!";

const signUp = await requestJson(`${apiUrl}/auth/v1/signup`, {
  key: anonKey,
  method: "POST",
  body: { email, password },
});
assert(signUp.response.ok, `El alta Auth sintetica devolvio HTTP ${signUp.response.status}.`);
const accessToken = signUp.data?.access_token;
const refreshToken = signUp.data?.refresh_token;
assert(accessToken && refreshToken, "El alta Auth local no devolvio una sesion.");

const beforeLogout = await requestJson(`${apiUrl}/auth/v1/user`, { key: anonKey, token: accessToken });
assert(beforeLogout.response.ok, "La sesion Auth sintetica no era valida antes de revocarla.");

const logout = await requestJson(`${apiUrl}/auth/v1/logout?scope=global`, {
  key: anonKey,
  token: accessToken,
  method: "POST",
});
assert(logout.response.ok, `El logout global local devolvio HTTP ${logout.response.status}.`);

const refresh = await requestJson(`${apiUrl}/auth/v1/token?grant_type=refresh_token`, {
  key: anonKey,
  method: "POST",
  body: { refresh_token: refreshToken },
});
assert(!refresh.response.ok, "Un refresh token revocado no debe emitir una sesion nueva.");

const residual = await requestJson(`${apiUrl}/auth/v1/user`, { key: anonKey, token: accessToken });
console.log(`Auth revocation baseline: refresh revocado; access token previo HTTP ${residual.response.status} hasta su expiracion JWT.`);
