import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { BrandingForm } from "./BrandingForm";

export default async function MarcaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = user
    ? await getCurrentOrgMembership(supabase, user.id)
    : null;

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Marca</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          No perteneces a ninguna organización.
        </p>
      </div>
    );
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("name, tagline_template, logo_url, primary_color")
    .eq("id", membership.organizationId)
    .single();

  if (!organization) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Marca</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          No se encontró la organización.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Marca</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Así se ve tu portal para tus alumnos: nombre, logo, color y el mensaje
        de bienvenida de tu página de inicio.
      </p>
      <BrandingForm organization={organization} />
    </div>
  );
}
