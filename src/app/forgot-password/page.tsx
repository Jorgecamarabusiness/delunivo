import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { orgPath } from "@/lib/organizations/orgPath";

export default async function ForgotPasswordPage() {
  const loginHref = await orgPath("/login");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            Recupera tu contraseña
          </h1>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Te enviaremos un enlace a tu correo para elegir una nueva.
          </p>

          <ForgotPasswordForm />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link href={loginHref} className="font-medium underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
