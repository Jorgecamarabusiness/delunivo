import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { formatPrice } from "@/lib/format";
import { CourseCreateForm } from "./CourseCreateForm";
import { CourseManagementActions } from "./CourseManagementActions";

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = user
    ? await getCurrentOrgMembership(supabase, user.id)
    : null;

  // Sin organización propia (super_admin sin empresa) no hay cursos que
  // listar todavía — no hay vista de plataforma cross-organización (Fase 6).
  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay cursos.
        </p>
      </div>
    );
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, price, status, sections(id), lessons(id)")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gestiona el currículum de cada curso.
        </p>

        <CourseCreateForm />

        <div className="mt-8 flex flex-col gap-4">
          {!courses || courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay cursos.
            </p>
          ) : (
            courses.map((course) => (
              <Card
                key={course.id}
                role="article"
                aria-labelledby={`course-${course.id}-title`}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id={`course-${course.id}-title`}
                      className="min-w-0 max-w-full [overflow-wrap:anywhere] text-lg font-semibold leading-snug"
                    >
                      {course.title}
                    </h2>
                    <Badge variant={course.status === "published" ? "solid" : "outline"}>
                      {course.status === "published" ? "Público" : "Privado"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(Number(course.price))} ·{" "}
                    {course.sections.length} secciones ·{" "}
                    {course.lessons.length} lecciones
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.status === "published"
                      ? "Visible en la tienda de tu empresa."
                      : "Solo lo ven los administradores."}
                  </p>
                </div>
                <div className="flex min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link
                      href={`/admin/cursos/${course.id}/ajustes`}
                      className={buttonClassName("outline", "md", "w-full sm:w-auto")}
                    >
                      Ajustes
                    </Link>
                    <Link
                      href={`/admin/cursos/${course.id}`}
                      className={buttonClassName("neutral", "md", "w-full sm:w-auto")}
                    >
                      Currículum
                    </Link>
                  </div>
                  <CourseManagementActions
                    courseId={course.id}
                    courseTitle={course.title}
                    initialStatus={
                      course.status === "published" ? "published" : "draft"
                    }
                  />
                </div>
              </Card>
            ))
          )}
        </div>
    </div>
  );
}
