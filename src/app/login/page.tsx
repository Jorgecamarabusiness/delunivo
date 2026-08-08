import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LoginForm } from "./LoginForm";
import { orgPath } from "@/lib/organizations/orgPath";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string; enlace?: string; next?: string }>;
}) {
  const { password, enlace, next } = await searchParams;
  const [registerHref, basePath] = await Promise.all([
    orgPath("/register"),
    orgPath(""),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            Inicia sesión en tu cuenta
          </h1>

          {password === "actualizada" && (
            <p className="mt-6 rounded-md border border-border bg-muted px-4 py-3 text-center text-sm font-medium">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </p>
          )}

          {enlace === "invalido" && (
            <p className="mt-6 rounded-md border border-border bg-muted px-4 py-3 text-center text-sm font-medium text-red-600">
              Ese enlace ha caducado o no es válido.
            </p>
          )}

          <LoginForm next={next} basePath={basePath} />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿No tienes una cuenta?{" "}
            <Link href={registerHref} className="font-medium underline">
              Regístrate
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
