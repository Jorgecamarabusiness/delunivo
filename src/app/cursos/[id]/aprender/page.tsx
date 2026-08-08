import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AprenderView } from "./AprenderView";
import { resolveBlocksForViewing } from "@/lib/storage/media";
import { orgPath } from "@/lib/organizations/orgPath";
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

function AccessRevoked() {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-center">
        <p className="text-sm font-semibold">Tu acceso a este curso ha sido revocado.</p>
        <p className="text-sm text-muted-foreground">
          Contacta con el administrador de la organización si crees que es un error.
        </p>
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
    .select("id, title, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!course) {
    return <NotFound />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(await orgPath("/login"));
  }

  const [{ data: isOrgAdmin }, { data: purchase }, { data: isActiveStudent }] =
    await Promise.all([
      supabase.rpc("is_org_admin", { org_id: course.organization_id }),
      supabase
        .from("purchases")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", id)
        .maybeSingle(),
      supabase.rpc("is_org_student", { org_id: course.organization_id }),
    ]);

  const isAdmin = Boolean(isOrgAdmin);
  const hasPurchased = Boolean(purchase);

  if (!isAdmin && !hasPurchased) {
    redirect(await orgPath(`/cursos/${id}`));
  }

  // Compró el curso pero ya no está activo en el roster de la organización
  // (lo echaron) — RLS ya le bloquea sections/lessons; esto solo da un
  // mensaje claro en vez de una página vacía.
  if (!isAdmin && !isActiveStudent) {
    return <AccessRevoked />;
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
      basePath={await orgPath("")}
    />
  );
}
