import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
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
      "id, title, price, description, long_description, learning_points, thumbnail_url, organization_id"
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

  const { data: organization } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", course.organization_id)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Ajustes del curso</h1>
        {organization ? (
          <Link
            href={`/o/${organization.slug}/cursos/${course.id}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName("outline", "sm", "w-full sm:w-auto")}
          >
            Vista previa ↗
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Lo que ven tus alumnos antes de comprar. El contenido (capítulos y
        lecciones) se edita en el currículum.
      </p>

      <CourseSettingsForm
        course={{
          id: course.id,
          title: course.title,
          price: course.price,
          description: course.description,
          long_description: course.long_description,
          learning_points: course.learning_points,
          thumbnail_url: course.thumbnail_url,
        }}
      />

      <Link
        href={`/admin/cursos/${course.id}`}
        className="mt-8 inline-block text-sm font-medium hover:underline"
      >
        Editar currículum →
      </Link>
    </div>
  );
}
