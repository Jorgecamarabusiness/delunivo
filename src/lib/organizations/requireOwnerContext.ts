import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "./getCurrentOrgMembership";
import { requireOrgOwner } from "@/lib/auth/requireOrgAdmin";

export type OwnerContext = {
  userId: string;
  organizationId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/**
 * El discriminante es `ok` (booleano literal) y no `error`: TypeScript solo
 * estrecha una unión al desestructurar si el campo que la distingue tiene tipo
 * literal, y `string | null` no lo es.
 */
export type OwnerContextResult =
  | { ok: false; error: string }
  | { ok: true; context: OwnerContext };

/**
 * Contexto de "soy el propietario de esta empresa" para las server actions de
 * facturación y cobros, que son las dos zonas restringidas al `owner` (no vale
 * cualquier admin de la organización).
 *
 * Devuelve `{ error }` en vez de lanzar: quien llama lo pinta en su formulario.
 * Esta comprobación es la de la capa de aplicación; la RLS de Supabase la repite
 * por su cuenta (`is_org_owner`), no se sustituyen entre sí.
 */
export async function requireOwnerContext(
  options: { allowInactive?: boolean; organizationId?: string } = {}
): Promise<OwnerContextResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión para hacer esto." };
  }

  const membership = options.organizationId
    ? null
    : await getCurrentOrgMembership(supabase, user.id);
  const organizationId = options.organizationId ?? membership?.organizationId;
  if (!organizationId) {
    return { ok: false, error: "No perteneces a ninguna empresa." };
  }

  const ownerCheck = await requireOrgOwner(supabase, {
    organizationId,
  }, options);
  if (ownerCheck.error) {
    return { ok: false, error: ownerCheck.error };
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      organizationId,
      supabase,
    },
  };
}
