import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/layout/AuthShell";
import { orgPath } from "@/lib/organizations/orgPath";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { CODE_TTL_MINUTES } from "@/lib/auth/verificationCodes";
import { VerifyForm } from "./VerifyForm";

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; delivery?: string }>;
}) {
  const { email, next, delivery } = await searchParams;

  // Sin correo no hay nada que verificar; se llega aquí solo desde el registro.
  if (!email) {
    redirect(await orgPath("/login"));
  }

  const loginHref = await orgPath("/login");
  const fallbackNext = await orgPath("/cursos");

  return (
    <AuthShell
      title="Confirma tu correo"
      subtitle={
        <>
          Te hemos enviado un código de {CODE_TTL_MINUTES} minutos a{" "}
          <strong className="text-foreground">{email}</strong>.
        </>
      }
      footer={
        <Link href={loginHref} className="font-medium underline">
          Volver a iniciar sesión
        </Link>
      }
    >
      <VerifyForm
        email={email}
        next={safeNextPath(next) ?? fallbackNext}
        deliveryNeedsRetry={delivery === "retry"}
      />
    </AuthShell>
  );
}
