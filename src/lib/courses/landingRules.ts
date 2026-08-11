/**
 * Reglas de qué cursos se enseñan en la portada de una empresa y cuándo aparece
 * el enlace "Cursos" del header.
 *
 * Vive aparte de publicCourses.ts a propósito: aquí no se importa Supabase ni
 * nada de Next, así que son funciones puras que se pueden probar con unit tests
 * sin levantar servidor ni base de datos (ver src/lib/courses/landingRules.test.ts).
 */

export type LandingCourse = {
  id: string;
  title: string;
  price: number;
  thumbnailUrl: string | null;
  shortDescription: string | null;
};

/** Cuántos cursos caben en la portada: el destacado + 3 más. */
export const LANDING_COURSE_LIMIT = 4;

/**
 * El enlace "Cursos" del header solo tiene sentido cuando hay cursos que la
 * portada NO está enseñando ya. Con 1 curso sería redundante; con 4 también,
 * porque la portada los enseña todos.
 */
export function shouldShowCoursesNav(totalPublished: number): boolean {
  return totalPublished > LANDING_COURSE_LIMIT;
}

/**
 * Reparte los cursos publicados en lo que necesita la portada: el destacado que
 * haya elegido el admin (o el más antiguo, si no eligió ninguno) arriba, y hasta
 * 3 más debajo.
 */
export function splitForLanding(
  courses: LandingCourse[],
  featuredCourseId: string | null
): { featured: LandingCourse | null; rest: LandingCourse[]; hasMore: boolean } {
  if (courses.length === 0) {
    return { featured: null, rest: [], hasMore: false };
  }

  // Si el id apunta a un curso que ya no existe o dejó de estar publicado, se
  // cae al más antiguo en vez de dejar la portada sin nada.
  const featured =
    courses.find((course) => course.id === featuredCourseId) ?? courses[0];

  const rest = courses
    .filter((course) => course.id !== featured.id)
    .slice(0, LANDING_COURSE_LIMIT - 1);

  return {
    featured,
    rest,
    hasMore: shouldShowCoursesNav(courses.length),
  };
}
