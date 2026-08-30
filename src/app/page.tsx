import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { DelunivoLanding } from "./DelunivoLanding";
import { OrganizationLanding } from "./OrganizationLanding";
import { isAnyOrgAdmin } from "@/lib/auth/requireOrgAdmin";

/**
 * Esta misma ruta atiende el dominio raíz (la web de Delunivo) y `/o/<slug>`
 * (el portal de esa empresa, tras el rewrite de src/proxy.ts) — de ahí la rama
 * según si hay organización resuelta.
 */
export default async function Home() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    organization,
  ] = await Promise.all([supabase.auth.getUser(), getCurrentOrganization()]);

  if (!organization) {
    const isAdmin = user ? await isAnyOrgAdmin(supabase, user.id) : false;
    return <DelunivoLanding isAdmin={isAdmin} />;
  }

  return (
    <OrganizationLanding
      organization={organization}
      isLoggedIn={Boolean(user)}
    />
  );
}
