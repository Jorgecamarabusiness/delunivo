import { createClient } from "@/lib/supabase/server";
import type { LandingCourse } from "./landingRules";

export type PublicCourse = LandingCourse;

// Las reglas puras de la portada viven en landingRules.ts (sin dependencias de
// Supabase ni Next, para poder probarlas con unit tests). Se re-exportan aquí
// para que quien las use no tenga que saber en cuál de los dos archivos están.
export {
  LANDING_COURSE_LIMIT,
  shouldShowCoursesNav,
  splitForLanding,
} from "./landingRules";

/** Cursos publicados de una empresa, del más antiguo al más nuevo. */
export async function getPublishedCourses(
  organizationId: string
): Promise<PublicCourse[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("courses")
    .select("id, title, price, thumbnail_url, description")
    .eq("organization_id", organizationId)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  return (data ?? []).map((course) => ({
    id: course.id,
    title: course.title,
    price: Number(course.price),
    thumbnailUrl: course.thumbnail_url,
    shortDescription: course.description?.trim() || null,
  }));
}
