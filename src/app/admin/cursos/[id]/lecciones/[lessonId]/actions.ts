"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { validateContentBlocks } from "@/lib/lessons/contentBlocks";
import { processMuxDeletionJobs } from "@/lib/mux/deletionJobs";
import type { ContentBlock } from "@/types";

type ActionResult = {
  error: string | null;
};

export async function updateLessonBlocksAction(
  lessonId: string,
  blocks: ContentBlock[]
): Promise<ActionResult> {
  const supabase = await createClient();

  const adminCheck = await requireOrgAdmin(supabase, { lessonId });
  if (adminCheck.error) return adminCheck;

  const validated = validateContentBlocks(blocks);
  if (validated.error || !validated.blocks) {
    return { error: validated.error ?? "El contenido de la lección no es válido." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("update_lesson_blocks_with_mux_assets", {
    p_lesson_id: lessonId,
    p_blocks: validated.blocks,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function updateLessonTitleAction(
  lessonId: string,
  title: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const adminCheck = await requireOrgAdmin(supabase, { lessonId });
  if (adminCheck.error) return adminCheck;

  const trimmed = title.trim();
  if (!trimmed) {
    return { error: "El título no puede estar vacío." };
  }

  const { error } = await supabase
    .from("lessons")
    .update({ title: trimmed })
    .eq("id", lessonId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteLessonAction(
  lessonId: string,
  courseId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const adminCheck = await requireOrgAdmin(supabase, { courseId });
  if (adminCheck.error) return adminCheck;

  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .eq("course_id", courseId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/admin/cursos/${courseId}`);
  after(async () => {
    try {
      await processMuxDeletionJobs();
    } catch (cleanupError) {
      console.error("La limpieza inmediata de Mux quedó pendiente para reintento.", cleanupError);
    }
  });
  redirect(`/admin/cursos/${courseId}`);
}
