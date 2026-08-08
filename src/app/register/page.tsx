import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { RegisterForm } from "./RegisterForm";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";

export default async function RegisterPage() {
  // Sin organización resuelta (dominio raíz) no hay registro de alumno que
  // ofrecer — ese dominio es la landing de alta de empresas (Fase 6).
  const organization = await getCurrentOrganization();
  if (!organization) {
    redirect("/");
  }

  const loginHref = await orgPath("/login");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            Crea tu cuenta
          </h1>

          <RegisterForm />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿Ya tienes una cuenta?{" "}
            <Link href={loginHref} className="font-medium underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
