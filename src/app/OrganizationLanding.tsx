import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClassName } from "@/components/ui/Button";
import { CourseCard, CourseThumbnail } from "@/components/courses/CourseCard";
import { formatPrice } from "@/lib/format";
import {
  getPublishedCourses,
  splitForLanding,
} from "@/lib/courses/publicCourses";
import {
  renderTagline,
  type CurrentOrganization,
} from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";

/**
 * Portal público de una empresa (/o/<slug>). El hero lo protagoniza el curso
 * destacado que elija el admin en /admin/marca — su imagen y su precio — con el
 * texto que haya escrito, y debajo caben hasta 3 cursos más (4 en total). El
 * resto, si los hay, se ven en /cursos, y el Header enseña el enlace "Cursos".
 */
export async function OrganizationLanding({
  organization,
  isLoggedIn,
}: {
  organization: CurrentOrganization;
  isLoggedIn: boolean;
}) {
  const courses = await getPublishedCourses(organization.id);
  const { featured, rest, hasMore } = splitForLanding(
    courses,
    organization.featuredCourseId
  );

  const [coursesHref, loginHref] = await Promise.all([
    orgPath("/cursos"),
    orgPath("/login"),
  ]);

  const featuredHref = featured
    ? await orgPath(`/cursos/${featured.id}`)
    : null;

  const tagline = renderTagline(organization);

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main id="contenido-principal" className="flex-1">
        <section className="border-b border-border">
          <Container className="py-12 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col items-start">
                <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                  {tagline}
                </h1>

                {organization.heroSubtitle && (
                  <p className="mt-5 text-base text-muted-foreground sm:text-lg">
                    {organization.heroSubtitle}
                  </p>
                )}

                {featured && featuredHref ? (
                  <>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Link
                        href={featuredHref}
                        className={buttonClassName(
                          "primary",
                          "lg",
                          "w-full sm:w-auto"
                        )}
                      >
                        Ver {featured.title}
                      </Link>

                      {hasMore && (
                        <Link
                          href={coursesHref}
                          className={buttonClassName(
                            "outline",
                            "lg",
                            "w-full sm:w-auto"
                          )}
                        >
                          Ver todos los cursos
                        </Link>
                      )}
                    </div>

                    <p className="mt-4 text-sm text-muted-foreground">
                      Desde {formatPrice(featured.price)}
                    </p>
                  </>
                ) : (
                  <p className="mt-8 text-sm text-muted-foreground">
                    Todavía no hay cursos publicados. Vuelve pronto.
                  </p>
                )}
              </div>

              {featured && featuredHref && (
                <Link
                  href={featuredHref}
                  className="block overflow-hidden rounded-lg border border-border"
                >
                  <CourseThumbnail
                    title={featured.title}
                    thumbnailUrl={featured.thumbnailUrl}
                    className="aspect-video"
                  />
                </Link>
              )}
            </div>
          </Container>
        </section>

        {rest.length > 0 && (
          <section>
            <Container className="py-14 sm:py-20">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight">
                  Más cursos
                </h2>
                {hasMore && (
                  <Link
                    href={coursesHref}
                    className="text-sm font-medium hover:underline"
                  >
                    Ver todos →
                  </Link>
                )}
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((course) => (
                  <CourseCardLink key={course.id} course={course} />
                ))}
              </div>
            </Container>
          </section>
        )}

        {!isLoggedIn && courses.length > 0 && (
          <section className="border-t border-border">
            <Container width="sm" className="py-14 text-center sm:py-20">
              <h2 className="text-2xl font-bold tracking-tight">
                ¿Ya tienes acceso?
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Inicia sesión para continuar donde lo dejaste.
              </p>
              <Link
                href={loginHref}
                className={buttonClassName("outline", "md", "mt-6")}
              >
                Iniciar sesión
              </Link>
            </Container>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}

/** Envuelve CourseCard resolviendo el href con el prefijo de la empresa. */
async function CourseCardLink({
  course,
}: {
  course: Awaited<ReturnType<typeof getPublishedCourses>>[number];
}) {
  const href = await orgPath(`/cursos/${course.id}`);
  return <CourseCard course={course} href={href} />;
}
