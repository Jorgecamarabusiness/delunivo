import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BuyCourseButton } from "./BuyCourseButton";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";

async function NotFound() {
  const homeHref = await orgPath("/");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <div className="mx-auto flex flex-1 flex-col items-center gap-4 px-6 py-24 text-center">
        <p className="text-sm text-muted-foreground">Curso no encontrado.</p>
        <Link href={homeHref} className="text-sm font-medium hover:underline">
          ← Volver al inicio
        </Link>
      </div>
      <Footer />
    </div>
  );
}

export default async function CursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, price, long_description, learning_points, status, organization_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!course) {
    return <NotFound />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let hasPurchased = false;

  if (user) {
    const [{ data: isOrgAdmin }, { data: purchase }] = await Promise.all([
      supabase.rpc("is_org_admin", { org_id: course.organization_id }),
      supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", course.id)
        .maybeSingle(),
    ]);

    isAdmin = Boolean(isOrgAdmin);
    hasPurchased = Boolean(purchase);
  }

  if (course.status !== "published" && !isAdmin) {
    return <NotFound />;
  }

  const longDescription = (course.long_description ?? "")
    .split("\n\n")
    .map((paragraph: string) => paragraph.trim())
    .filter((paragraph: string) => paragraph.length > 0);
  const learningPoints = course.learning_points ?? [];
  const aprenderHref = await orgPath(`/cursos/${course.id}/aprender`);
  const loginHref = await orgPath("/login");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-muted">
            <span className="text-sm font-medium text-muted-foreground">
              Imagen del curso
            </span>
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">
            {course.title}
          </h1>

          <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              {longDescription.map((paragraph: string, index: number) => (
                <p key={index} className="leading-relaxed text-foreground/80">
                  {paragraph}
                </p>
              ))}

              {learningPoints.length > 0 ? (
                <div>
                  <h2 className="text-lg font-semibold">Lo que aprenderás</h2>
                  <ul className="mt-4 flex flex-col gap-3">
                    {learningPoints.map((point: string) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 text-sm"
                      >
                        <span className="mt-0.5 font-bold">✓</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="h-fit rounded-lg border border-border p-6 lg:sticky lg:top-8">
              {hasPurchased ? (
                <>
                  <p className="text-sm font-medium">Ya tienes acceso a este curso.</p>
                  <Link
                    href={aprenderHref}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                  >
                    Ir al curso →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Precio</p>
                  <p className="mt-1 text-4xl font-bold">${course.price}</p>

                  {user ? (
                    <BuyCourseButton courseId={course.id} />
                  ) : (
                    <Link
                      href={loginHref}
                      className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
                    >
                      Inicia sesión para comprar
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
