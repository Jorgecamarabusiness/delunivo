import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { buttonClassName } from "@/components/ui/Button";
import { EyeIcon } from "@/components/ui/Icons";
import { CurriculumEditor } from "./CurriculumEditor";

function NotFound({ message }: { message: string }) {
  return (
    <div className="flex items-center px-6 py-24">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default async function CourseCurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const adminCheck = await requireOrgAdmin(supabase, { courseId: id });
  if (adminCheck.error) notFound();

  const [courseResult, sectionsResult, lessonsResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status, organization_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sections")
      .select("id, title, order_index, status")
      .eq("course_id", id)
      .order("order_index", { ascending: true }),
    supabase
      .from("lessons")
      .select("id, section_id, title, order_index, status")
      .eq("course_id", id)
      .order("order_index", { ascending: true }),
  ]);

  const course = courseResult.data;

  if (!course) {
    return <NotFound message="Curso no encontrado." />;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", course.organization_id)
    .maybeSingle();

  const lessons = lessonsResult.data ?? [];
  const sections = (sectionsResult.data ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    status: section.status === "draft" ? "draft" as const : "published" as const,
    lessons: lessons
      .filter((lesson) => lesson.section_id === section.id)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        status: lesson.status === "draft" ? "draft" as const : "published" as const,
      })),
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      {organization ? (
        <div className="mb-5 flex justify-end">
          <Link
            href={`/o/${organization.slug}/cursos/${course.id}`}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName("outline", "sm")}
          >
            <EyeIcon className="h-4 w-4" />
            Vista previa
          </Link>
        </div>
      ) : null}
      <CurriculumEditor
        course={{
          id: course.id,
          title: course.title,
          status: course.status === "draft" ? "draft" : "published",
        }}
        sections={sections}
      />
    </div>
  );
}
