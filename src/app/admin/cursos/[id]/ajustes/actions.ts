"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import type { ActionResult } from "@/types";

export async function updateCourseSettingsAction(
  formData: FormData
): Promise<ActionResult> {
  const courseId = String(formData.get("courseId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const longDescription = String(formData.get("longDescription") ?? "").trim();
  const thumbnailUrl = String(formData.get("thumbnailUrl") ?? "").trim();
  const learningPointsRaw = String(formData.get("learningPoints") ?? "");

  if (!courseId) return { error: "Falta el curso." };
  if (!title) return { error: "Ponle un título al curso." };

  const price = Number(priceRaw);
  if (!priceRaw || Number.isNaN(price) || price < 0) {
    return { error: "Introduce un precio válido." };
  }

  const supabase = await createClient();
  const adminCheck = await requireOrgAdmin(supabase, { courseId });
  if (adminCheck.error) return adminCheck;

  // Un punto por línea; se descartan las vacías para que un salto de línea de
  // más no cree una viñeta en blanco en la ficha pública.
  const learningPoints = learningPointsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const { error } = await supabase
    .from("courses")
    .update({
      title,
      price,
      // `description` y `learning_points` son NOT NULL sin default en la base
      // de datos (ver docs/database.md) — nunca se pueden mandar como null.
      description,
      long_description: longDescription || null,
      learning_points: learningPoints,
      thumbnail_url: thumbnailUrl || null,
    })
    .eq("id", courseId);

  if (error) return { error: error.message };

  revalidatePath("/admin/cursos");
  revalidatePath("/", "layout");
  return { error: null };
}
