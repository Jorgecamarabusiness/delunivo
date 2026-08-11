import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { CourseCard } from "@/components/courses/CourseCard";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";
import { getPublishedCourses } from "@/lib/courses/publicCourses";

export default async function CursosPage() {
  const organization = await getCurrentOrganization();

  // Sin empresa resuelta (dominio raíz) no hay catálogo que enseñar: ahí lo que
  // hay es la web de Aularia.
  if (!organization) {
    redirect("/");
  }

  const courses = await getPublishedCourses(organization.id);

  // Con un solo curso, un listado de un elemento es un paso de más.
  if (courses.length === 1) {
    redirect(await orgPath(`/cursos/${courses[0].id}`));
  }

  const prefix = await orgPath("");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <Container width="md" className="py-12 sm:py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Cursos de {organization.name}
          </h1>

          {courses.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Todavía no hay cursos publicados. Vuelve pronto.
            </p>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  href={`${prefix}/cursos/${course.id}`}
                />
              ))}
            </div>
          )}
        </Container>
      </main>

      <Footer />
    </div>
  );
}
