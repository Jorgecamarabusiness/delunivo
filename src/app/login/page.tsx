import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    password?: string;
    verificado?: string;
    next?: string;
  }>;
}) {
  const { password, verificado, next } = await searchParams;
  const [registerHref, basePath, organization] = await Promise.all([
    orgPath("/register"),
    orgPath(""),
    getCurrentOrganization(),
  ]);

  return (
    <AuthShell
      title="Inicia sesión en tu cuenta"
      footer={
        // En el dominio raíz "registrarse" significa crear una empresa, no ser
        // alumno de nadie: ahí el enlace no tiene sentido.
        organization ? (
          <>
            ¿No tienes una cuenta?{" "}
            <Link href={registerHref} className="font-medium underline">
              Regístrate
            </Link>
          </>
        ) : (
          <>
            ¿Aún no tienes tu escuela?{" "}
            <Link href="/crear-empresa" className="font-medium underline">
              Créala aquí
            </Link>
          </>
        )
      }
    >
      {password === "actualizada" && (
        <Alert variant="success" className="mt-6">
          Contraseña actualizada. Ya puedes iniciar sesión.
        </Alert>
      )}

      {verificado === "1" && (
        <Alert variant="success" className="mt-6">
          Correo confirmado. Ya puedes iniciar sesión.
        </Alert>
      )}

      <LoginForm next={next} basePath={basePath} />
    </AuthShell>
  );
}
