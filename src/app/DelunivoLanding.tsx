import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClassName } from "@/components/ui/Button";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/brand";
import { formatPlatformPrice } from "@/lib/billing/access";
import { PlatformLogo } from "@/components/media/PlatformLogo";

const FEATURES = [
  {
    title: "Tu marca, no la nuestra",
    body: "Tu nombre, tu logo y tu color en todo el portal. Tus alumnos entran en tu escuela, no en un marketplace lleno de competencia.",
  },
  {
    title: "Cobra tú directamente",
    body: `Conecta tu propia cuenta de Stripe y el dinero de cada venta te llega a ti. ${PLATFORM_NAME} no toca tus cobros ni se queda comisión por venta.`,
  },
  {
    title: "Vídeo protegido",
    body: "Reproducción protegida con enlaces firmados que caducan y se entregan solo a quien tiene acceso al curso.",
  },
];

const STEPS = [
  {
    title: "Crea tu escuela",
    body: "Pon el nombre de tu empresa y ya tienes tu portal funcionando.",
  },
  {
    title: "Sube tus cursos",
    body: "Capítulos, lecciones, vídeos y texto. Publica cuando esté listo.",
  },
  {
    title: "Empieza a vender",
    body: "Comparte tu enlace. Tus alumnos compran, entran y aprenden.",
  },
];

/**
 * Dominio raíz (sin /o/<slug>): la web de Delunivo como producto. El formulario
 * de alta vive en /crear-empresa para que esta página pueda ser una landing de
 * verdad y no un formulario suelto.
 */
export function DelunivoLanding({
  isAdmin,
  priceCents,
}: {
  isAdmin: boolean;
  priceCents: number;
}) {
  const monthlyPrice = formatPlatformPrice(priceCents);
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main id="contenido-principal" className="flex-1">
        <section className="border-b border-border">
          <Container className="py-20 text-center sm:py-28">
            <div className="flex justify-center">
              <PlatformLogo size="lg" priority />
            </div>
            <p className="mt-6 text-sm font-semibold text-accent-content">
              Tu escuela online, en marcha hoy
            </p>

            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
              {PLATFORM_DESCRIPTION}
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
              Con {PLATFORM_NAME} puedes montar tu academia con tu marca, subir
              tus cursos y cobrar a tus alumnos sin comisiones por venta.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {isAdmin ? (
                <Link
                  href="/admin"
                  className={buttonClassName("primary", "lg", "w-full sm:w-auto")}
                >
                  Entrar
                </Link>
              ) : (
                <>
                  <Link
                    href="/crear-empresa"
                    className={buttonClassName("primary", "lg", "w-full sm:w-auto")}
                  >
                    Crear mi empresa
                  </Link>
                  <Link
                    href="/login"
                    className={buttonClassName("outline", "lg", "w-full sm:w-auto")}
                  >
                    Iniciar sesión
                  </Link>
                </>
              )}
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              {monthlyPrice} al mes. Cancela cuando quieras.
            </p>
          </Container>
        </section>

        <section className="border-b border-border">
          <Container className="py-16 sm:py-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border p-6"
                >
                  <h2 className="font-semibold">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="border-b border-border">
          <Container className="py-16 sm:py-20">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Cómo funciona
            </h2>

            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-2 font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section>
          <Container width="sm" className="py-16 text-center sm:py-24">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Un precio, todo incluido
            </h2>
            <p className="mt-4 text-5xl font-bold tracking-tight">
              {monthlyPrice}
              <span className="text-lg font-medium text-muted-foreground">
                /mes
              </span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Cursos y alumnos ilimitados. Sin permanencia y sin comisión por
              cada venta que hagas.
            </p>

            <Link
              href={isAdmin ? "/admin" : "/crear-empresa"}
              className={buttonClassName("primary", "lg", "mt-8")}
            >
              {isAdmin ? "Entrar" : "Crear mi empresa"}
            </Link>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
