import { createClient } from "@/lib/supabase/server";
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

  const [courseResult, sectionsResult, lessonsResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, status")
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
