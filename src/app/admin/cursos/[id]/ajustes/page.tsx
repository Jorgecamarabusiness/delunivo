import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { Alert } from "@/components/ui/Alert";
import { CourseSettingsForm } from "./CourseSettingsForm";

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const adminCheck = await requireOrgAdmin(supabase, { courseId: id });
  if (adminCheck.error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes del curso</h1>
        <Alert variant="error" className="mt-8">
          {adminCheck.error}
        </Alert>
      </div>
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, price, description, long_description, learning_points, thumbnail_url"
    )
    .eq("id", id)
    .maybeSingle();

  if (!course) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes del curso</h1>
        <Alert variant="error" className="mt-8">
          No se encontró el curso.
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/admin/cursos"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Cursos
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Ajustes del curso
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Lo que ven tus alumnos antes de comprar. El contenido (capítulos y
        lecciones) se edita en el currículum.
      </p>

      <CourseSettingsForm course={course} />

      <Link
        href={`/admin/cursos/${course.id}`}
        className="mt-8 inline-block text-sm font-medium hover:underline"
      >
        Editar currículum →
      </Link>
    </div>
  );
}
