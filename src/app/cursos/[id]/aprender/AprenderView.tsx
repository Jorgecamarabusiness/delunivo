"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lesson, Section } from "@/types";
import { Button } from "@/components/ui/Button";
import { VideoBlock } from "@/components/lesson-blocks/VideoBlock";
import { VideoFileBlock } from "@/components/lesson-blocks/VideoFileBlock";
import { TextBlock } from "@/components/lesson-blocks/TextBlock";
import { BlockTypeIcon } from "@/components/lesson-blocks/blockMeta";
import { Alert } from "@/components/ui/Alert";
import { setLessonCompletedAction } from "./actions";

type CourseWithContent = {
  id: string;
  title: string;
  sections: Section[];
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function AprenderView({
  course,
  initialLessonId,
  completedLessonIds,
  basePath,
}: {
  course: CourseWithContent;
  initialLessonId?: string;
  /** Lecciones ya completadas, leídas de video_views en el servidor. */
  completedLessonIds: string[];
  basePath: string;
}) {
  const sections = useMemo(
    () => [...course.sections].sort((a, b) => a.order - b.order),
    [course.sections]
  );

  const flatLessons = useMemo<Lesson[]>(
    () =>
      sections.flatMap((section) =>
        [...section.lessons].sort((a, b) => a.order - b.order)
      ),
    [sections]
  );

  const [activeLessonId, setActiveLessonId] = useState<string | null>(
    () =>
      (initialLessonId &&
        flatLessons.find((lesson) => lesson.id === initialLessonId)?.id) ||
      flatLessons[0]?.id ||
      null
  );
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(completedLessonIds)
  );
  // En móvil el índice es un cajón que se abre por encima del contenido. En
  // escritorio (lg+) siempre está visible y este estado no se usa.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeIndex = flatLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = activeIndex >= 0 ? flatLessons[activeIndex] : null;
  const isLastLesson = activeIndex === flatLessons.length - 1;

  const progress =
    flatLessons.length > 0
      ? Math.round((completed.size / flatLessons.length) * 100)
      : 0;

  /**
   * Se actualiza la interfaz al momento y se guarda en segundo plano: marcar
   * una lección no debe hacer esperar a nadie. Si el guardado falla, se revierte
   * el cambio para no enseñar un progreso que no está en la base de datos.
   */
  function setLessonCompleted(lessonId: string, value: boolean) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (value) next.add(lessonId);
      else next.delete(lessonId);
      return next;
    });

    void setLessonCompletedAction(lessonId, value).then((result) => {
      if (!result.error) return;

      setCompleted((prev) => {
        const next = new Set(prev);
        if (value) next.delete(lessonId);
        else next.add(lessonId);
        return next;
      });
      setSaveError("No se pudo guardar tu progreso. Revisa tu conexión.");
    });
  }

  function toggleCompleted(lessonId: string, event: React.MouseEvent) {
    event.stopPropagation();
    setLessonCompleted(lessonId, !completed.has(lessonId));
  }

  function selectLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    setSidebarOpen(false);
  }

  function completeAndContinue() {
    if (!activeLesson) return;

    if (!completed.has(activeLesson.id)) {
      setLessonCompleted(activeLesson.id, true);
    }

    const nextLesson = flatLessons[activeIndex + 1];
    if (nextLesson) {
      setActiveLessonId(nextLesson.id);
    }
  }

  const lessonIndex = (
    <>
      <h1 className="text-lg font-bold leading-snug">{course.title}</h1>

      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">
          {progress}% completado
        </p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.id} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {[...section.lessons]
              .sort((a, b) => a.order - b.order)
              .map((lesson) => {
                const isActive = lesson.id === activeLessonId;
                const isCompleted = completed.has(lesson.id);

                return (
                  <li key={lesson.id}>
                    <div
                      className={`flex items-center gap-3 rounded-md px-2 py-2 transition-colors ${
                        isActive
                          ? "bg-foreground text-background"
                          : "hover:bg-muted"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(event) => toggleCompleted(lesson.id, event)}
                        aria-label={
                          isCompleted
                            ? "Marcar lección como pendiente"
                            : "Marcar lección como completada"
                        }
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                          isCompleted
                            ? "border-foreground bg-foreground text-background"
                            : isActive
                              ? "border-background"
                              : "border-border"
                        }`}
                      >
                        {isCompleted ? "✓" : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectLesson(lesson.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        {lesson.blocks[0] ? (
                          <BlockTypeIcon
                            type={lesson.blocks[0].type}
                            className={`h-4 w-4 shrink-0 ${
                              isActive
                                ? "text-background/70"
                                : "text-muted-foreground"
                            }`}
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium leading-snug">
                            {lesson.title}
                          </span>
                          {lesson.duration ? (
                            <span
                              className={`block text-xs ${
                                isActive
                                  ? "text-background/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatDuration(lesson.duration)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </>
  );

  return (
    // dvh y no vh: en iOS la barra de direcciones recorta el 100vh y el último
    // trozo del contenido queda debajo del borde de la pantalla.
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir índice del curso"
          className="rounded-md border border-border p-2 lg:hidden"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        </button>

        <Link
          href={`${basePath}/cursos/${course.id}`}
          className="truncate text-sm font-medium hover:underline"
        >
          <span className="lg:hidden">← Volver</span>
          <span className="hidden lg:inline">← Volver a la ficha del curso</span>
        </Link>

        <span className="hidden truncate text-sm font-semibold sm:inline">
          {course.title}
        </span>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar índice"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-10 bg-foreground/40 lg:hidden"
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-20 w-[85%] max-w-xs overflow-y-auto border-r border-border bg-background p-6 transition-transform lg:static lg:w-80 lg:max-w-none lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:shrink-0`}
        >
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="mb-4 text-sm text-muted-foreground underline lg:hidden"
          >
            Cerrar
          </button>

          {lessonIndex}
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeLesson ? (
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lección {activeIndex + 1} de {flatLessons.length}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                {activeLesson.title}
              </h2>

              <div className="mt-6 flex flex-col gap-6">
                {activeLesson.blocks.map((block) => {
                  if (block.type === "video") {
                    return <VideoBlock key={block.id} block={block} />;
                  }
                  if (block.type === "video_file") {
                    return <VideoFileBlock key={block.id} block={block} />;
                  }
                  return <TextBlock key={block.id} block={block} />;
                })}
              </div>

              {saveError && (
                <Alert variant="error" className="mt-6">
                  {saveError}
                </Alert>
              )}

              <div className="mt-8 flex justify-end">
                <Button
                  variant="primary"
                  onClick={completeAndContinue}
                  className="w-full sm:w-auto"
                >
                  {isLastLesson ? "Completar curso" : "Completar y continuar →"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este curso todavía no tiene lecciones.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
