import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { formatPrice } from "@/lib/format";
import { createCourseAction } from "./actions";

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
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay cursos.
        </p>
      </div>
    );
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, price, status")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: true });

  const courseIds = (courses ?? []).map((course) => course.id);

  const [{ data: sections }, { data: lessons }] =
    courseIds.length > 0
      ? await Promise.all([
          supabase.from("sections").select("id, course_id").in("course_id", courseIds),
          supabase.from("lessons").select("id, course_id").in("course_id", courseIds),
        ])
      : [{ data: [] }, { data: [] }];

  const sectionCounts = new Map<string, number>();
  for (const section of sections ?? []) {
    sectionCounts.set(
      section.course_id,
      (sectionCounts.get(section.course_id) ?? 0) + 1
    );
  }

  const lessonCounts = new Map<string, number>();
  for (const lesson of lessons ?? []) {
    lessonCounts.set(
      lesson.course_id,
      (lessonCounts.get(lesson.course_id) ?? 0) + 1
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gestiona el currículum de cada curso.
        </p>

        <form
          action={createCourseAction}
          className="mt-8 flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="title">
              Título del nuevo curso
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Ej. Marketing Digital para Emprendedores"
              className="min-w-[260px] rounded-md border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="price">
              Precio
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="49.00"
              className="w-28 rounded-md border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
            />
          </div>
          <button type="submit" className={buttonClassName("primary", "md")}>
            Crear curso
          </button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          El curso se crea en borrador — publícalo desde su currículum cuando esté listo.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {!courses || courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay cursos.
            </p>
          ) : (
            courses.map((course) => (
              <Card
                key={course.id}
                className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold leading-snug">
                      {course.title}
                    </h2>
                    <Badge variant={course.status === "published" ? "solid" : "outline"}>
                      {course.status === "published" ? "Publicado" : "Borrador"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(Number(course.price))} ·{" "}
                    {sectionCounts.get(course.id) ?? 0} secciones ·{" "}
                    {lessonCounts.get(course.id) ?? 0} lecciones
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/admin/cursos/${course.id}/ajustes`}
                    className={buttonClassName("outline", "md")}
                  >
                    Ajustes
                  </Link>
                  <Link
                    href={`/admin/cursos/${course.id}`}
                    className={buttonClassName("neutral", "md")}
                  >
                    Currículum
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
    </div>
  );
}
