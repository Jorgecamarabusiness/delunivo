import Link from "next/link";
import { AuthShell } from "@/components/layout/AuthShell";
import { orgPath } from "@/lib/organizations/orgPath";
import { CODE_TTL_MINUTES } from "@/lib/auth/verificationCodes";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const forgotHref = await orgPath("/forgot-password");

  return (
    <AuthShell
      title="Elige una nueva contraseña"
      subtitle={`Escribe el código de ${CODE_TTL_MINUTES} minutos que te hemos enviado por correo y tu contraseña nueva.`}
      footer={
        <Link href={forgotHref} className="font-medium underline">
          Pedir otro código
        </Link>
      }
    >
      <ResetPasswordForm email={email ?? ""} />
    </AuthShell>
  );
}
