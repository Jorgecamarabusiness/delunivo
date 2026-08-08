"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";

export async function createCourseAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = Number(priceRaw);

  if (!title) {
    throw new Error("Ponle un título al curso.");
  }
  if (!priceRaw || Number.isNaN(price) || price < 0) {
    throw new Error("Introduce un precio válido.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Debes iniciar sesión para hacer esto.");
  }

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) {
    throw new Error("No perteneces a ninguna organización.");
  }

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      organization_id: membership.organizationId,
      title,
      price,
      status: "draft",
      description: "",
      learning_points: [],
    })
    .select("id")
    .single();

  if (error || !course) {
    throw new Error(error?.message ?? "No se pudo crear el curso.");
  }

  revalidatePath("/admin/cursos");
  redirect(`/admin/cursos/${course.id}`);
}
