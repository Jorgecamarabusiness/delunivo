import { CourseBarChart } from "./CourseBarChart";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function lastSixMonths(): { key: string; label: string }[] {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MESES[date.getMonth()],
    });
  }

  return months;
}

export default async function EstadisticasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = user
    ? await getCurrentOrgMembership(supabase, user.id)
    : null;

  // Sin organización propia (super_admin sin empresa) no hay estadísticas
  // que mostrar todavía — no hay vista de plataforma cross-organización
  // (Fase 6).
  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay cursos publicados.
        </p>
      </div>
    );
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title")
    .eq("organization_id", membership.organizationId);

  const courseIds = (courses ?? []).map((course) => course.id);

  const [{ data: purchases }, { data: lessons }] = await Promise.all([
    supabase
      .from("purchases")
      .select("course_id, amount_paid, purchased_at")
      .eq("organization_id", membership.organizationId),
    courseIds.length > 0
      ? supabase.from("lessons").select("id, course_id").in("course_id", courseIds)
      : Promise.resolve({ data: [] as { id: string; course_id: string }[] }),
  ]);

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id);

  const { data: videoViews } =
    lessonIds.length > 0
      ? await supabase
          .from("video_views")
          .select("user_id, lesson_id")
          .in("lesson_id", lessonIds)
      : { data: [] as { user_id: string; lesson_id: string }[] };

  const lessonToCourse = new Map<string, string>();
  for (const lesson of lessons ?? []) {
    lessonToCourse.set(lesson.id, lesson.course_id);
  }

  const viewCountByUserLesson = new Map<string, number>();
  const visualizacionesByCourse = new Map<string, number>();
  for (const view of videoViews ?? []) {
    const courseId = lessonToCourse.get(view.lesson_id);
    if (!courseId) continue;

    visualizacionesByCourse.set(
      courseId,
      (visualizacionesByCourse.get(courseId) ?? 0) + 1
    );

    const key = `${view.user_id}:${view.lesson_id}`;
    viewCountByUserLesson.set(key, (viewCountByUserLesson.get(key) ?? 0) + 1);
  }

  const rewatchesByCourse = new Map<string, number>();
  for (const [key, count] of viewCountByUserLesson) {
    if (count <= 1) continue;
    const lessonId = key.split(":")[1];
    const courseId = lessonToCourse.get(lessonId);
    if (!courseId) continue;
    rewatchesByCourse.set(courseId, (rewatchesByCourse.get(courseId) ?? 0) + 1);
  }

  const months = lastSixMonths();
  const ingresosByCourse = new Map<string, number>();
  const comprasCountByCourse = new Map<string, number>();
  const comprasByCourseAndMonth = new Map<string, Map<string, number>>();

  for (const purchase of purchases ?? []) {
    ingresosByCourse.set(
      purchase.course_id,
      (ingresosByCourse.get(purchase.course_id) ?? 0) + purchase.amount_paid
    );
    comprasCountByCourse.set(
      purchase.course_id,
      (comprasCountByCourse.get(purchase.course_id) ?? 0) + 1
    );

    const purchaseDate = new Date(purchase.purchased_at);
    const monthKey = `${purchaseDate.getFullYear()}-${purchaseDate.getMonth()}`;

    if (!comprasByCourseAndMonth.has(purchase.course_id)) {
      comprasByCourseAndMonth.set(purchase.course_id, new Map());
    }
    const courseMonths = comprasByCourseAndMonth.get(purchase.course_id)!;
    courseMonths.set(monthKey, (courseMonths.get(monthKey) ?? 0) + 1);
  }

  const estadisticas = (courses ?? []).map((course) => {
    const courseMonths = comprasByCourseAndMonth.get(course.id);
    const data = months.map(({ key, label }) => ({
      mes: label,
      compras: courseMonths?.get(key) ?? 0,
    }));

    return {
      id: course.id,
      curso: course.title,
      visualizaciones: visualizacionesByCourse.get(course.id) ?? 0,
      rewatches: rewatchesByCourse.get(course.id) ?? 0,
      ingresos: ingresosByCourse.get(course.id) ?? 0,
      totalComprasHistorico: comprasCountByCourse.get(course.id) ?? 0,
      totalComprasUltimosSeisMeses: data.reduce((a, c) => a + c.compras, 0),
      data,
    };
  });

  const ingresosTotales = estadisticas.reduce((a, c) => a + c.ingresos, 0);
  const rewatchesTotales = estadisticas.reduce((a, c) => a + c.rewatches, 0);
  const cursoMasPopular =
    estadisticas.length === 0
      ? null
      : estadisticas.reduce((max, curso) =>
          curso.totalComprasHistorico > max.totalComprasHistorico
            ? curso
            : max
        );

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Estadísticas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rendimiento de cada curso publicado.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Ingresos totales</p>
            <p className="mt-2 text-2xl font-bold">
              {ingresosTotales.toLocaleString("es-ES")} €
            </p>
          </div>
          <div className="rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Curso más popular</p>
            <p className="mt-2 text-lg font-bold leading-snug">
              {cursoMasPopular?.curso ?? "Sin datos todavía"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">Rewatches totales</p>
            <p className="mt-2 text-2xl font-bold">
              {rewatchesTotales.toLocaleString("es-ES")}
            </p>
          </div>
        </div>

        {estadisticas.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            Todavía no hay cursos publicados.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {estadisticas.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-lg border border-border p-6"
              >
                <h2 className="text-lg font-semibold leading-snug">
                  {item.curso}
                </h2>

                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Visualizaciones</p>
                    <p className="font-semibold">
                      {item.visualizaciones.toLocaleString("es-ES")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rewatches</p>
                    <p className="font-semibold">
                      {item.rewatches.toLocaleString("es-ES")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ingresos</p>
                    <p className="font-semibold">
                      {item.ingresos.toLocaleString("es-ES")} €
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Compras (6 meses)</p>
                    <p className="font-semibold">
                      {item.totalComprasUltimosSeisMeses}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Compras nuevas por mes
                  </p>
                  <CourseBarChart data={item.data} />
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
