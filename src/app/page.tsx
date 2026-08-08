import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { buttonClassName } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOrganization,
  renderTagline,
} from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";
import { CreateCompanyForm } from "./CreateCompanyForm";

// Esta misma ruta atiende tanto el dominio raíz (landing de registro de
// empresas, sin organización resuelta) como /o/<slug> (home de esa
// organización, tras el rewrite de src/proxy.ts) — de ahí la rama según
// `organization`.
export default async function Home() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    organization,
  ] = await Promise.all([supabase.auth.getUser(), getCurrentOrganization()]);

  if (!organization) {
    return (
      <div className="flex flex-col flex-1 bg-background text-foreground">
        <Header />

        <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
          <div className="w-full max-w-sm">
            <h1 className="text-center text-2xl font-bold tracking-tight">
              Crea tu escuela online con Aularia
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Vende tus cursos con tu propia marca. 20€/mes, cancela cuando
              quieras.
            </p>

            <CreateCompanyForm />

            <p className="mt-8 text-center text-sm text-muted-foreground">
              ¿Ya tienes una cuenta?{" "}
              <Link href="/login" className="font-medium underline">
                Inicia sesión
              </Link>
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  const ctaHref = await orgPath(user ? "/cursos" : "/login");
  const tagline = renderTagline(organization);

  return (
    <div className="flex flex-col flex-1 bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-24 text-center sm:py-32">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            {tagline}
          </h1>
          <div className="mt-10">
            <Link href={ctaHref} className={buttonClassName("primary", "lg")}>
              Empezar a ver
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
