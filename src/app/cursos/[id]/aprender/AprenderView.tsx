"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lesson, Section } from "@/types";
import { Button } from "@/components/ui/Button";
import { VideoBlock } from "@/components/lesson-blocks/VideoBlock";
import { VideoFileBlock } from "@/components/lesson-blocks/VideoFileBlock";
import { TextBlock } from "@/components/lesson-blocks/TextBlock";
import { BlockTypeIcon } from "@/components/lesson-blocks/blockMeta";

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
  basePath,
}: {
  course: CourseWithContent;
  initialLessonId?: string;
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
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(
    new Set()
  );

  const activeIndex = flatLessons.findIndex((l) => l.id === activeLessonId);
  const activeLesson = activeIndex >= 0 ? flatLessons[activeIndex] : null;
  const isLastLesson = activeIndex === flatLessons.length - 1;

  const progress =
    flatLessons.length > 0
      ? Math.round((completedLessonIds.size / flatLessons.length) * 100)
      : 0;

  function toggleCompleted(lessonId: string, event: React.MouseEvent) {
    event.stopPropagation();
    setCompletedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  }

  function completeAndContinue() {
    if (!activeLesson) return;

    setCompletedLessonIds((prev) => new Set(prev).add(activeLesson.id));

    const nextLesson = flatLessons[activeIndex + 1];
    if (nextLesson) {
      setActiveLessonId(nextLesson.id);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href={`${basePath}/cursos/${course.id}`}
          className="text-sm font-medium hover:underline"
        >
          ← Volver a la ficha del curso
        </Link>
        <span className="text-sm font-semibold">{course.title}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-border p-6">
          <h1 className="text-lg font-bold leading-snug">{course.title}</h1>

          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground">
              {progress}% completado
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-foreground transition-all"
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
                    const isCompleted = completedLessonIds.has(lesson.id);

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
                            onClick={() => setActiveLessonId(lesson.id)}
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
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          {activeLesson ? (
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lección {activeIndex + 1} de {flatLessons.length}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
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

              <div className="mt-6 flex justify-end">
                <Button variant="primary" onClick={completeAndContinue}>
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
