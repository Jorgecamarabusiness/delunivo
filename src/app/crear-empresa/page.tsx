import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { CreateCompanyForm } from "../CreateCompanyForm";

export default async function CrearEmpresaPage() {
  // Crear una empresa es algo del dominio raíz. Dentro del portal de un cliente
  // (/o/<slug>/crear-empresa) no tiene sentido: ahí se va a su propia home.
  const organization = await getCurrentOrganization();
  if (organization) {
    redirect("/");
  }

  return (
    <AuthShell
      title="Crea tu escuela online"
      subtitle="Tendrás tu portal con tu marca funcionando en un minuto."
      footer={
        <>
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="font-medium underline">
            Inicia sesión
          </Link>
        </>
      }
    >
      <CreateCompanyForm />
    </AuthShell>
  );
}
