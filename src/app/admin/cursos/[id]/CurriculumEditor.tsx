"use client";

import { useState, type KeyboardEvent } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RowMenu } from "@/components/ui/RowMenu";
import type { CourseStatus } from "@/types";
import { updateLessonTitleAction } from "./lecciones/[lessonId]/actions";
import {
  createLessonAction,
  createSectionAction,
  deleteLessonAction,
  deleteSectionAction,
  reorderLessonsAction,
  reorderSectionsAction,
  updateCourseStatusAction,
  updateCourseTitleAction,
  updateLessonStatusAction,
  updateSectionStatusAction,
  updateSectionTitleAction,
} from "./actions";

type LessonSummary = {
  id: string;
  title: string;
  status: CourseStatus;
};

type SectionSummary = {
  id: string;
  title: string;
  status: CourseStatus;
  lessons: LessonSummary[];
};

type CourseSummary = {
  id: string;
  title: string;
  status: CourseStatus;
};

function StatusToggle({
  status,
  onToggle,
  disabled,
}: {
  status: CourseStatus;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={status === "published"}
      aria-busy={disabled}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
        status === "published"
          ? "bg-accent text-accent-foreground hover:bg-accent/90"
          : "border border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {disabled ? <LoadingSpinner className="h-3 w-3" /> : null}
      {disabled ? "Guardando…" : status === "published" ? "Publicado" : "Borrador"}
    </button>
  );
}

function LessonRow({
  lesson,
  courseId,
  sectionId,
  onTitleSaved,
  onStatusSaved,
  onDeleted,
}: {
  lesson: LessonSummary;
  courseId: string;
  sectionId: string;
  onTitleSaved: (sectionId: string, lessonId: string, title: string) => void;
  onStatusSaved: (sectionId: string, lessonId: string, status: CourseStatus) => void;
  onDeleted: (sectionId: string, lessonId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [titleDraft, setTitleDraft] = useState(lesson.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function toggleStatus() {
    const nextStatus: CourseStatus =
      lesson.status === "published" ? "draft" : "published";
    setIsTogglingStatus(true);
    setStatusError(null);
    const result = await updateLessonStatusAction(lesson.id, nextStatus);
    setIsTogglingStatus(false);

    if (result.error) {
      setStatusError(result.error);
      return;
    }
    onStatusSaved(sectionId, lesson.id, nextStatus);
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteLessonAction(lesson.id, courseId);
    setIsDeleting(false);

    if (result.error) {
      setDeleteError(result.error);
      return;
    }

    setDeleteDialogOpen(false);
    onDeleted(sectionId, lesson.id);
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === lesson.title) {
      setTitleDraft(lesson.title);
      setIsEditingTitle(false);
      return;
    }

    setTitleError(null);
    const result = await updateLessonTitleAction(lesson.id, trimmed);

    if (result.error) {
      setTitleError(result.error);
      setTitleDraft(lesson.title);
      setIsEditingTitle(false);
      return;
    }

    onTitleSaved(sectionId, lesson.id, trimmed);
    setIsEditingTitle(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setTitleDraft(lesson.title);
      setIsEditingTitle(false);
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
      >
      <button
        type="button"
        data-drag-handle
        {...attributes}
        {...listeners}
        aria-label="Reordenar lección"
        className="cursor-grab touch-none px-1 text-muted-foreground active:cursor-grabbing"
      >
        ⠿
      </button>

      <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={handleKeyDown}
            className="w-full border-b border-foreground bg-transparent text-sm font-medium outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            aria-label={`Editar título de ${lesson.title}`}
            className="-mx-1 block max-w-full cursor-text truncate rounded px-1 text-left text-sm font-medium transition-colors hover:bg-muted"
          >
            {lesson.title}
          </button>
        )}
        {titleError ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Error: {titleError}
          </p>
        ) : null}
        {deleteError ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            Error: {deleteError}
          </p>
        ) : null}
        {statusError ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            Error: {statusError}
          </p>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <StatusToggle
          status={lesson.status}
          onToggle={toggleStatus}
          disabled={isTogglingStatus}
        />

        <RowMenu
          editHref={`/admin/cursos/${courseId}/lecciones/${lesson.id}`}
          editLabel="Editar contenido"
          onDelete={() => {
            setDeleteError(null);
            setDeleteDialogOpen(true);
          }}
          isDeleting={isDeleting}
        />
      </div>
      </div>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar lección"
        description={`Se eliminará “${lesson.title}” y todo su contenido. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar lección"
        destructive
        pending={isDeleting}
        onClose={() => {
          if (!isDeleting) setDeleteDialogOpen(false);
        }}
        onConfirm={handleDelete}
      >
        {deleteError ? <Alert variant="error">{deleteError}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}

function SectionRow({
  section,
  courseId,
  onTitleSaved,
  onStatusSaved,
  onDeleted,
  onLessonTitleSaved,
  onLessonStatusSaved,
  onLessonDeleted,
  onLessonDragEnd,
}: {
  section: SectionSummary;
  courseId: string;
  onTitleSaved: (sectionId: string, title: string) => void;
  onStatusSaved: (sectionId: string, status: CourseStatus) => void;
  onDeleted: (sectionId: string) => void;
  onLessonTitleSaved: (sectionId: string, lessonId: string, title: string) => void;
  onLessonStatusSaved: (
    sectionId: string,
    lessonId: string,
    status: CourseStatus
  ) => void;
  onLessonDeleted: (sectionId: string, lessonId: string) => void;
  onLessonDragEnd: (sectionId: string, event: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isOpen, setIsOpen] = useState(true);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const lessonSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  async function toggleStatus() {
    const nextStatus: CourseStatus =
      section.status === "published" ? "draft" : "published";
    setIsTogglingStatus(true);
    setStatusError(null);
    const result = await updateSectionStatusAction(section.id, nextStatus);
    setIsTogglingStatus(false);

    if (result.error) {
      setStatusError(result.error);
      return;
    }
    onStatusSaved(section.id, nextStatus);
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    const result = await deleteSectionAction(section.id, courseId);
    setIsDeleting(false);

    if (result.error) {
      setDeleteError(result.error);
      return;
    }

    setDeleteDialogOpen(false);
    onDeleted(section.id);
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === section.title) {
      setTitleDraft(section.title);
      setIsEditingTitle(false);
      return;
    }

    setTitleError(null);
    const result = await updateSectionTitleAction(section.id, trimmed);

    if (result.error) {
      setTitleError(result.error);
      setTitleDraft(section.title);
      setIsEditingTitle(false);
      return;
    }

    onTitleSaved(section.id, trimmed);
    setIsEditingTitle(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setTitleDraft(section.title);
      setIsEditingTitle(false);
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="overflow-hidden rounded-lg border border-border bg-background"
      >
      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <button
          type="button"
          data-drag-handle
          {...attributes}
          {...listeners}
          aria-label="Reordenar sección"
          className="cursor-grab touch-none px-1 text-muted-foreground active:cursor-grabbing"
        >
          ⠿
        </button>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-label={isOpen ? "Contraer sección" : "Expandir sección"}
          className="text-muted-foreground transition-transform"
          style={{ transform: isOpen ? "rotate(180deg)" : undefined }}
        >
          ▾
        </button>

        <div className="min-w-0 flex-1 basis-[calc(100%-5rem)] sm:basis-auto">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={handleKeyDown}
              className="w-full border-b border-foreground bg-transparent font-semibold outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              aria-label={`Editar título de ${section.title}`}
              className="-mx-1 block max-w-full cursor-text truncate rounded px-1 text-left font-semibold transition-colors hover:bg-muted"
            >
              {section.title}
            </button>
          )}
          {titleError ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Error: {titleError}
            </p>
          ) : null}
          {deleteError ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Error: {deleteError}
            </p>
          ) : null}
          {statusError ? (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              Error: {statusError}
            </p>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <StatusToggle
            status={section.status}
            onToggle={toggleStatus}
            disabled={isTogglingStatus}
          />

          <RowMenu
            onDelete={() => {
              setDeleteError(null);
              setDeleteDialogOpen(true);
            }}
            isDeleting={isDeleting}
          />
        </div>
      </div>

      {section.status === "draft" ? (
        <p className="border-t border-border bg-muted px-4 py-2 text-xs text-muted-foreground">
          Este capítulo está en borrador: sus lecciones no son visibles para los alumnos,
          aunque estén publicadas individualmente.
        </p>
      ) : null}

      {isOpen && (
        <div className="border-t border-border">
          {section.lessons.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              Esta sección todavía no tiene lecciones.
            </p>
          ) : (
            <DndContext
              id={`section-${section.id}-lessons`}
              sensors={lessonSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => onLessonDragEnd(section.id, event)}
            >
              <SortableContext
                items={section.lessons.map((lesson) => lesson.id)}
                strategy={verticalListSortingStrategy}
              >
                {section.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    courseId={courseId}
                    sectionId={section.id}
                    onTitleSaved={onLessonTitleSaved}
                    onStatusSaved={onLessonStatusSaved}
                    onDeleted={onLessonDeleted}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          <form
            action={createLessonAction.bind(null, section.id, courseId)}
            className="border-t border-border px-6 py-3"
          >
            <SubmitButton
              pendingLabel="Creando lección…"
              variant="outline"
              size="sm"
            >
              + Nueva lección
            </SubmitButton>
          </form>
        </div>
      )}
      </div>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar capítulo"
        description={`Se eliminará “${section.title}” y todas sus lecciones. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar capítulo"
        destructive
        pending={isDeleting}
        onClose={() => {
          if (!isDeleting) setDeleteDialogOpen(false);
        }}
        onConfirm={handleDelete}
      >
        {deleteError ? <Alert variant="error">{deleteError}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}

export function CurriculumEditor({
  course,
  sections: initialSections,
}: {
  course: CourseSummary;
  sections: SectionSummary[];
}) {
  const [courseTitle, setCourseTitle] = useState(course.title);
  const [courseTitleDraft, setCourseTitleDraft] = useState(course.title);
  const [isEditingCourseTitle, setIsEditingCourseTitle] = useState(false);
  const [courseTitleError, setCourseTitleError] = useState<string | null>(null);

  const [status, setStatus] = useState<CourseStatus>(course.status);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [sections, setSections] = useState(initialSections);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [addSectionError, setAddSectionError] = useState<string | null>(null);

  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  async function saveCourseTitle() {
    const trimmed = courseTitleDraft.trim();
    if (!trimmed || trimmed === courseTitle) {
      setCourseTitleDraft(courseTitle);
      setIsEditingCourseTitle(false);
      return;
    }

    setCourseTitleError(null);
    const result = await updateCourseTitleAction(course.id, trimmed);

    if (result.error) {
      setCourseTitleError(result.error);
      setCourseTitleDraft(courseTitle);
      setIsEditingCourseTitle(false);
      return;
    }

    setCourseTitle(trimmed);
    setIsEditingCourseTitle(false);
  }

  function handleCourseTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setCourseTitleDraft(courseTitle);
      setIsEditingCourseTitle(false);
    }
  }

  async function toggleStatus() {
    const nextStatus: CourseStatus = status === "published" ? "draft" : "published";
    setIsTogglingStatus(true);
    setStatusError(null);

    const result = await updateCourseStatusAction(course.id, nextStatus);
    setIsTogglingStatus(false);

    if (result.error) {
      setStatusError(result.error);
      return;
    }

    setStatus(nextStatus);
  }

  async function handleAddSection() {
    setIsAddingSection(true);
    setAddSectionError(null);

    const result = await createSectionAction(course.id);
    setIsAddingSection(false);

    if (!result.ok) {
      setAddSectionError(result.error);
      return;
    }

    setSections((prev) => [...prev, { ...result.section, lessons: [] }]);
  }

  function handleSectionTitleSaved(sectionId: string, title: string) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, title } : section
      )
    );
  }

  function handleSectionStatusSaved(sectionId: string, status: CourseStatus) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, status } : section
      )
    );
  }

  function handleLessonTitleSaved(
    sectionId: string,
    lessonId: string,
    title: string
  ) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lessons: section.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, title } : lesson
              ),
            }
          : section
      )
    );
  }

  function handleLessonStatusSaved(
    sectionId: string,
    lessonId: string,
    status: CourseStatus
  ) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lessons: section.lessons.map((lesson) =>
                lesson.id === lessonId ? { ...lesson, status } : lesson
              ),
            }
          : section
      )
    );
  }

  function handleSectionDeleted(sectionId: string) {
    setSections((prev) => prev.filter((section) => section.id !== sectionId));
  }

  function handleLessonDeleted(sectionId: string, lessonId: string) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              lessons: section.lessons.filter((lesson) => lesson.id !== lessonId),
            }
          : section
      )
    );
  }

  async function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((section) => section.id === active.id);
    const newIndex = sections.findIndex((section) => section.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);

    await reorderSectionsAction(
      course.id,
      reordered.map((section) => section.id)
    );
  }

  async function handleLessonDragEnd(sectionId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;

    const oldIndex = section.lessons.findIndex((lesson) => lesson.id === active.id);
    const newIndex = section.lessons.findIndex((lesson) => lesson.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedLessons = arrayMove(section.lessons, oldIndex, newIndex);

    setSections((prev) =>
      prev.map((item) =>
        item.id === sectionId ? { ...item, lessons: reorderedLessons } : item
      )
    );

    await reorderLessonsAction(
      sectionId,
      reorderedLessons.map((lesson) => lesson.id)
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {isEditingCourseTitle ? (
            <input
              autoFocus
              value={courseTitleDraft}
              onChange={(event) => setCourseTitleDraft(event.target.value)}
              onBlur={saveCourseTitle}
              onKeyDown={handleCourseTitleKeyDown}
              className="w-full border-b-2 border-foreground bg-transparent text-2xl font-bold tracking-tight outline-none"
            />
          ) : (
            <h1 className="min-w-0 text-2xl font-bold tracking-tight">
              <button
                type="button"
                onClick={() => setIsEditingCourseTitle(true)}
                aria-label={`Editar título de ${courseTitle}`}
                className="-mx-1 block max-w-full cursor-text truncate rounded px-1 text-left transition-colors hover:bg-muted"
              >
                {courseTitle}
              </button>
            </h1>
          )}
          {courseTitleError ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Error: {courseTitleError}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={toggleStatus}
          disabled={isTogglingStatus}
          variant={status === "published" ? "primary" : "outline"}
          size="sm"
          className="w-full sm:w-auto"
          aria-pressed={status === "published"}
          aria-busy={isTogglingStatus}
        >
          {isTogglingStatus ? <LoadingSpinner /> : null}
          {isTogglingStatus
            ? "Guardando…"
            : status === "published"
              ? "Público · hacer privado"
              : "Privado · hacer público"}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {status === "published"
          ? "El curso está visible en la tienda de tu empresa."
          : "El curso solo es visible para administradores."}
      </p>
      {statusError ? (
        <Alert variant="error" className="mt-2">
          {statusError}
        </Alert>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este curso todavía no tiene secciones.
          </p>
        ) : (
          <DndContext
            id="course-sections"
            sensors={sectionSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSectionDragEnd}
          >
            <SortableContext
              items={sections.map((section) => section.id)}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  courseId={course.id}
                  onTitleSaved={handleSectionTitleSaved}
                  onStatusSaved={handleSectionStatusSaved}
                  onDeleted={handleSectionDeleted}
                  onLessonTitleSaved={handleLessonTitleSaved}
                  onLessonStatusSaved={handleLessonStatusSaved}
                  onLessonDeleted={handleLessonDeleted}
                  onLessonDragEnd={handleLessonDragEnd}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddSection}
            disabled={isAddingSection}
          >
            {isAddingSection ? "Creando..." : "+ Nueva sección"}
          </Button>
          {addSectionError ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Error: {addSectionError}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
