import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  // Sin organización resuelta (dominio raíz) no hay registro de alumno que
  // ofrecer — ese dominio es la landing de alta de empresas.
  const organization = await getCurrentOrganization();
  if (!organization) {
    redirect("/");
  }

  const loginHref = await orgPath("/login");

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle={`Entra en ${organization.name} y accede a sus cursos.`}
      footer={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link href={loginHref} className="font-medium underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
