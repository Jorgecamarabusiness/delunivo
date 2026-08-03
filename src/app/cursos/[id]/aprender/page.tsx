import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AprenderView } from "./AprenderView";
import { resolveBlocksForViewing } from "@/lib/storage/media";
import type { ContentBlock, Lesson, Section } from "@/types";

function NotFound() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <div className="mx-auto flex flex-1 items-center px-6 py-24">
        <p className="text-sm text-muted-foreground">Curso no encontrado.</p>
      </div>
      <Footer />
    </div>
  );
}

export default async function AprenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { id } = await params;
  const { lesson: initialLessonId } = await searchParams;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (!course) {
    return <NotFound />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: purchase }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
    supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", id)
      .maybeSingle(),
  ]);

  const isAdmin = profile?.is_admin ?? false;
  const hasPurchased = Boolean(purchase);

  if (!isAdmin && !hasPurchased) {
    redirect(`/cursos/${id}`);
  }

  const [{ data: sectionsData }, { data: lessonsData }] = await Promise.all([
    supabase
      .from("sections")
      .select("id, course_id, title, order_index, status")
      .eq("course_id", id)
      .eq("status", "published")
      .order("order_index", { ascending: true }),
    supabase
      .from("lessons")
      .select("id, section_id, course_id, title, order_index, blocks, status")
      .eq("course_id", id)
      .eq("status", "published")
      .order("order_index", { ascending: true }),
  ]);

  const sections: Section[] = await Promise.all(
    (sectionsData ?? []).map(async (section) => ({
      id: section.id,
      courseId: section.course_id,
      title: section.title,
      order: section.order_index,
      status: "published" as const,
      lessons: await Promise.all(
        (lessonsData ?? [])
          .filter((lesson) => lesson.section_id === section.id)
          .map(async (lesson): Promise<Lesson> => ({
            id: lesson.id,
            sectionId: lesson.section_id,
            courseId: lesson.course_id,
            title: lesson.title,
            order: lesson.order_index,
            duration: 0,
            isPreview: false,
            status: "published",
            // Las URLs de vídeo se firman aquí, DESPUÉS de comprobar arriba que
            // el usuario es admin o ha comprado el curso. No mover esta
            // resolución antes de esa comprobación.
            blocks: await resolveBlocksForViewing(
              (lesson.blocks ?? []) as ContentBlock[]
            ),
          }))
      ),
    }))
  );

  return (
    <AprenderView
      course={{ id: course.id, title: course.title, sections }}
      initialLessonId={initialLessonId}
    />
  );
}
