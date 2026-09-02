import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { buttonClassName } from "@/components/ui/Button";
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

  const [{ data: organization }, { data: courses }] = await Promise.all([
    supabase
      .from("organizations")
      .select(
        "name, slug, owner_id, tagline_template, hero_subtitle, featured_course_id, logo_url, primary_color"
      )
      .eq("id", membership.organizationId)
      .single(),
    // Solo se puede destacar un curso publicado: uno en borrador no se ve en el
    // portal público, así que no puede protagonizar la portada.
    supabase
      .from("courses")
      .select("id, title")
      .eq("organization_id", membership.organizationId)
      .eq("status", "published")
      .order("created_at", { ascending: true }),
  ]);

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

  const { data: ownerProfile } = organization.owner_id
    ? await supabase
        .from("profiles")
        .select("name")
        .eq("id", organization.owner_id)
        .maybeSingle()
    : { data: null };

  const ownerName = ownerProfile?.name?.trim() || organization.name;
  const siteOrigin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Marca</h1>
        <Link
          href={`/o/${organization.slug}`}
          target="_blank"
          rel="noreferrer"
          className={buttonClassName("outline", "sm", "w-full sm:w-auto")}
        >
          Vista previa ↗
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Así se ve tu portal para tus alumnos: nombre, logo, color y los textos
        y el curso que protagonizan tu página de inicio.
      </p>
      <BrandingForm
        organization={organization}
        courses={courses ?? []}
        ownerName={ownerName}
        siteOrigin={siteOrigin}
      />
    </div>
  );
}
