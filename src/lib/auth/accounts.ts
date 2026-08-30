import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Busca un usuario de auth por correo, sin distinguir mayúsculas.
 *
 * Supabase no expone "dame el usuario con este email" en la API de admin, así
 * que se resuelve por `profiles` (la fila la crea sola el trigger
 * `on_auth_user_created`, ver docs/database.md). Devuelve null si no existe.
 */
export async function findUserByEmail(
  admin: AdminClient,
  email: string
): Promise<{ id: string; email: string } | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", email.trim())
    .maybeSingle();

  if (!data) return null;

  return { id: data.id, email: data.email };
}

/**
 * Crea la cuenta con el correo SIN confirmar y sin que Supabase mande ningún
 * email: la verificación la hace Delunivo con su propio código (ver
 * verificationCodes.ts) y Resend.
 *
 * Se usa `admin.createUser` en vez de `signUp()` a propósito. Con la
 * confirmación de correo activada, `signUp()` sobre un email que YA existe
 * devuelve un usuario falso con un uuid inventado (protección anti-enumeración
 * de Supabase); ese uuid no está en `auth.users`, así que cualquier insert
 * posterior que lo referencie revienta con un error de clave foránea — que es
 * exactamente el fallo "organizations_owner_id_fkey" que daba el alta de
 * empresa. `createUser` devuelve un error limpio y explícito en ese caso.
 */
export async function createUnverifiedUser(
  admin: AdminClient,
  params: { email: string; password: string; name: string }
): Promise<{ userId: string | null; error: string | null }> {
  const existing = await findUserByEmail(admin, params.email);
  if (existing) {
    return {
      userId: null,
      error: "Ya existe una cuenta con ese correo. Inicia sesión.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: false,
    user_metadata: { name: params.name },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return {
        userId: null,
        error: "Ya existe una cuenta con ese correo. Inicia sesión.",
      };
    }
    return { userId: null, error: error.message };
  }

  if (!data.user) {
    return { userId: null, error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  return { userId: data.user.id, error: null };
}

/**
 * Deja la sesión iniciada tras verificar un código, sin volver a pedirle la
 * contraseña al usuario.
 *
 * `generateLink` produce un token de un solo uso SIN enviar ningún email (para
 * eso existe: para mandarlo con tu propio proveedor), y `verifyOtp` lo canjea
 * por una sesión sobre el cliente con cookies. Si algo falla, quien llama debe
 * mandar al usuario a /login — por eso devuelve un booleano en vez de lanzar.
 */
export async function startSessionForVerifiedEmail(
  email: string
): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return false;

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  return !verifyError;
}
