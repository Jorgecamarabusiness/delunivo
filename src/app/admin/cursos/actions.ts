"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { processMuxDeletionJobs } from "@/lib/mux/deletionJobs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";

export type CourseActionState = {
  error: string | null;
};

export async function createCourseAction(
  _previousState: CourseActionState,
  formData: FormData
): Promise<CourseActionState> {
  const title = String(formData.get("title") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = Number(priceRaw);

  if (!title) {
    return { error: "Ponle un título al curso." };
  }
  if (title.length > 160) {
    return { error: "El título no puede superar los 160 caracteres." };
  }
  if (!priceRaw || Number.isNaN(price) || price < 0) {
    return { error: "Introduce un precio válido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const membership = await getCurrentOrgMembership(supabase, user.id);
  if (!membership) {
    return { error: "No perteneces a ninguna organización." };
  }

  const adminCheck = await requireOrgAdmin(supabase, {
    organizationId: membership.organizationId,
  });
  if (adminCheck.error) {
    return adminCheck;
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
    return { error: error?.message ?? "No se pudo crear el curso." };
  }

  revalidatePath("/admin/cursos");
  redirect(`/admin/cursos/${course.id}`);
}

export async function deleteCourseAction(
  courseId: string
): Promise<CourseActionState> {
  const supabase = await createClient();
  const adminCheck = await requireOrgAdmin(supabase, { courseId });
  if (adminCheck.error) return adminCheck;

  const admin = createAdminClient();
  const purchasesResult = await admin
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (purchasesResult.error) {
    return { error: "No se pudo comprobar si el curso se puede eliminar." };
  }
  if ((purchasesResult.count ?? 0) > 0) {
    return {
      error:
        "Este curso tiene ventas y no se puede eliminar sin perder el historial de compras. Déjalo privado si ya no quieres venderlo.",
    };
  }

  const { data: deletedCourse, error } = await supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .select("id")
    .maybeSingle();

  if (error || !deletedCourse) {
    if (error?.code === "23503") {
      return {
        error:
          "Este curso acaba de recibir una venta y ya no se puede eliminar. Déjalo privado si no quieres seguir vendiéndolo.",
      };
    }
    return { error: error?.message ?? "No se pudo eliminar el curso." };
  }

  after(async () => {
    try {
      await processMuxDeletionJobs();
    } catch (cleanupError) {
      console.error("La limpieza inmediata de Mux quedó pendiente para reintento.", cleanupError);
    }
  });

  revalidatePath("/admin/cursos");
  revalidatePath("/cursos");
  revalidatePath("/o", "layout");
  return { error: null };
}
