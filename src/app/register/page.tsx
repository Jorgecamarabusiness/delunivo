import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { RegisterForm } from "./RegisterForm";
import { safeNextPath } from "@/lib/auth/safeNextPath";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Sin organización resuelta (dominio raíz) no hay registro de alumno que
  // ofrecer — ese dominio es la landing de alta de empresas.
  const organization = await getCurrentOrganization();
  if (!organization) {
    redirect("/");
  }

  const next = safeNextPath((await searchParams).next);
  const loginHref = await orgPath("/login");
  const loginWithNextHref = next
    ? `${loginHref}?next=${encodeURIComponent(next)}`
    : loginHref;

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle={`Entra en ${organization.name} y accede a sus cursos.`}
      footer={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link href={loginWithNextHref} className="font-medium underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <RegisterForm next={next ?? undefined} />
    </AuthShell>
  );
}
