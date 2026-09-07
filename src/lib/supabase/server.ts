import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AuthSessionMissingError, createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll fue llamado desde un Server Component.
            // Se puede ignorar si hay middleware refrescando la sesión.
          }
        },
      },
    }
  );
  const originalGetUser = client.auth.getUser.bind(client.auth);
  // A successful Auth lookup alone does not establish that an old JWT still has
  // an active application account/session. All server consumers share this gate.
  client.auth.getUser = async (jwt?: string) => {
    const result = await originalGetUser(jwt);
    if (!result.data.user) return result;
    const scoped = jwt ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false, autoRefreshToken: false },
    }) : client;
    const active = await scoped.rpc("current_account_is_active");
    if (active.error || active.data !== true) return { data: { user: null }, error: new AuthSessionMissingError() };
    return result;
  };
  return client;
}
