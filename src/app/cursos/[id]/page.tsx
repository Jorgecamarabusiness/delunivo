import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClassName } from "@/components/ui/Button";
import { CourseThumbnail } from "@/components/courses/CourseCard";
import { BuyCourseButton } from "./BuyCourseButton";
import { createClient } from "@/lib/supabase/server";
import { orgPath } from "@/lib/organizations/orgPath";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { formatPrice } from "@/lib/format";

async function NotFound() {
  const homeHref = await orgPath("/");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
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

  const [{ data: course }, organization] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, price, long_description, learning_points, status, organization_id, thumbnail_url"
      )
      .eq("id", id)
      .maybeSingle(),
    getCurrentOrganization(),
  ]);

  if (!course) {
    return <NotFound />;
  }

  // La policy RLS de `courses` deja leer cualquier fila publicada de cualquier
  // empresa (lo necesita el sitio público), así que sin esta comprobación
  // /o/empresaA/cursos/<id-de-empresaB> pintaba el curso de B con la marca de
  // A. La URL manda: si el curso no es de la empresa del portal, no existe aquí.
  if (!organization || course.organization_id !== organization.id) {
    return <NotFound />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let hasAccess = false;

  if (user) {
    const [{ data: isOrgAdmin }, { data: courseAccess }] = await Promise.all([
      supabase.rpc("is_org_admin", { org_id: course.organization_id }),
      supabase.rpc("has_course_access", { target_course_id: course.id }),
    ]);

    isAdmin = Boolean(isOrgAdmin);
    hasAccess = Boolean(courseAccess);
  }

  if (course.status !== "published" && !isAdmin) {
    return <NotFound />;
  }

  const longDescription = (course.long_description ?? "")
    .split("\n\n")
    .map((paragraph: string) => paragraph.trim())
    .filter((paragraph: string) => paragraph.length > 0);
  const learningPoints: string[] = course.learning_points ?? [];
  const aprenderHref = await orgPath(`/cursos/${course.id}/aprender`);
  const loginHref = await orgPath("/login");

  const purchasePanel = hasAccess ? (
    <>
      <p className="text-sm font-medium">Ya tienes acceso a este curso.</p>
      <Link
        href={aprenderHref}
        className={buttonClassName("primary", "md", "mt-4 w-full")}
      >
        Ir al curso →
      </Link>
    </>
  ) : (
    <>
      <p className="text-sm text-muted-foreground">Precio</p>
      <p className="mt-1 text-4xl font-bold">{formatPrice(Number(course.price))}</p>

      {user ? (
        <BuyCourseButton courseId={course.id} />
      ) : (
        <Link
          href={loginHref}
          className={buttonClassName("primary", "md", "mt-6 w-full")}
        >
          Inicia sesión para comprar
        </Link>
      )}
    </>
  );

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <Container width="md" className="py-10 sm:py-16">
          <div className="overflow-hidden rounded-lg border border-border">
            <CourseThumbnail
              title={course.title}
              thumbnailUrl={course.thumbnail_url}
              className="aspect-video"
            />
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">
            {course.title}
          </h1>

          {/* En móvil la caja de compra iba al final del grid, después de toda
              la descripción: había que hacer scroll hasta abajo para ver el
              precio. Ahora aparece también arriba y se oculta en escritorio,
              donde ya está la columna lateral fija. */}
          <div className="mt-6 rounded-lg border border-border p-6 lg:hidden">
            {purchasePanel}
          </div>

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
                      <li key={point} className="flex items-start gap-3 text-sm">
                        <span className="mt-0.5 font-bold text-accent">✓</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="hidden h-fit rounded-lg border border-border p-6 lg:sticky lg:top-8 lg:block">
              {purchasePanel}
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
