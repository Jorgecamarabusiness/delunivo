import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { orgPath } from "@/lib/organizations/orgPath";
import { CODE_TTL_MINUTES } from "@/lib/auth/verificationCodes";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const loginHref = await orgPath("/login");

  return (
    <AuthShell
      title="Recupera tu contraseña"
      subtitle={`Te enviaremos un código de ${CODE_TTL_MINUTES} minutos para elegir una nueva.`}
      footer={
        <Link href={loginHref} className="font-medium underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
