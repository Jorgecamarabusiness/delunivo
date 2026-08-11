import { type ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

/**
 * Envoltorio común de todas las pantallas de cuenta (login, registro,
 * verificación, recuperar y cambiar contraseña). El layout raíz no pinta
 * Header/Footer, así que cada página tenía que repetir este armazón entero.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-2xl font-bold tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}

          {children}

          {footer && (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
