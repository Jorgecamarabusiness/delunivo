import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Alert } from "@/components/ui/Alert";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export function LegalPage({
  title,
  identityComplete,
  children,
}: {
  title: string;
  identityComplete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main id="contenido-principal" className="flex-1">
        <Container width="sm" className="py-12 sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Última actualización: 2 de septiembre de 2026.
          </p>
          {!identityComplete ? (
            <Alert variant="error" className="mt-6">
              Documento pendiente de completar con los datos fiscales del
              titular antes de aceptar clientes o cobros reales.
            </Alert>
          ) : null}
          <div className="mt-8 space-y-7 text-sm leading-7 text-foreground">
            {children}
          </div>
          <Link href="/" className="mt-10 inline-block text-sm font-medium underline">
            Volver a Delunivo
          </Link>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
