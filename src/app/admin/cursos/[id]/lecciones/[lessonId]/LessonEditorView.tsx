"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { ContentBlock } from "@/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowMenu } from "@/components/ui/RowMenu";
import { AddContentPanel } from "@/components/lesson-blocks/AddContentPanel";
import { BLOCK_DEFAULT_TITLES, BlockTypeIcon } from "@/components/lesson-blocks/blockMeta";
import { TextBlockForm } from "@/components/lesson-blocks/forms/TextBlockForm";
import { EmbedMediaForm } from "@/components/lesson-blocks/forms/EmbedMediaForm";
import { VideoFileForm } from "@/components/lesson-blocks/forms/VideoFileForm";
import { MuxVideoStatus } from "@/components/lesson-blocks/MuxVideoStatus";
import {
  deleteLessonAction,
  updateLessonBlocksAction,
  updateLessonTitleAction,
} from "./actions";

type CourseSummary = {
  id: string;
  title: string;
  publicPath: string | null;
};

type SectionSummary = {
  id: string;
  title: string;
};

type LessonSummary = {
  id: string;
  title: string;
  blocks: ContentBlock[];
};

function BlockRow({
  lessonId,
  blocks,
  block,
  index,
  onSaved,
  onDelete,
  isDeleting,
}: {
  lessonId: string;
  blocks: ContentBlock[];
  block: ContentBlock;
  index: number;
  onSaved: (blocks: ContentBlock[]) => void;
  onDelete: () => Promise<string | null>;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  async function saveBlock(updatedBlock: ContentBlock) {
    setIsSaving(true);
    setError(null);

    const newBlocks = blocks.map((item) =>
      item.id === block.id ? updatedBlock : item
    );
    const result = await updateLessonBlocksAction(lessonId, newBlocks);

    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSaved(newBlocks);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-md border border-border p-4">
        {block.type === "text" ? (
          <TextBlockForm
            lessonId={lessonId}
            initialTitle={block.title ?? ""}
            initialContent={block.content}
            onCancel={() => setIsEditing(false)}
            isSaving={isSaving}
            error={error}
            submitLabel="Guardar sustitución"
            onSubmit={(title, content) =>
              saveBlock({ ...block, title, content })
            }
          />
        ) : block.type === "video" ? (
          <EmbedMediaForm
            initialTitle={block.title ?? ""}
            initialUrl={block.video_url}
            onCancel={() => setIsEditing(false)}
            isSaving={isSaving}
            error={error}
            submitLabel="Guardar cambios"
            onSubmit={(title, video_url) =>
              saveBlock({ ...block, title, video_url })
            }
          />
        ) : (
          <VideoFileForm
            lessonId={lessonId}
            blockId={block.id}
            initialTitle={block.title ?? ""}
            initialUrl={block.video_url ?? ""}
            initialMuxVideoAssetId={block.mux_video_asset_id}
            onCancel={() => setIsEditing(false)}
            isSaving={isSaving}
            error={error}
            submitLabel="Guardar cambios"
            onSubmit={(title, selection) =>
              saveBlock(
                selection.muxVideoAssetId
                  ? {
                      id: block.id,
                      type: "video_file",
                      title,
                      mux_video_asset_id: selection.muxVideoAssetId,
                    }
                  : {
                      id: block.id,
                      type: "video_file",
                      title,
                      video_url: selection.legacyUrl,
                    }
              )
            }
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-border p-4"
    >
      <button
        type="button"
        data-drag-handle
        {...attributes}
        {...listeners}
        aria-label="Reordenar bloque"
        className="cursor-grab touch-none px-1 text-muted-foreground active:cursor-grabbing"
      >
        ⠿
      </button>

      <span className="text-xs font-medium text-muted-foreground">
        {index + 1}
      </span>
      <BlockTypeIcon type={block.type} className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {block.title ?? BLOCK_DEFAULT_TITLES[block.type]}
        </span>
        {block.type === "video_file" && block.mux_video_asset_id ? (
          <MuxVideoStatus videoAssetId={block.mux_video_asset_id} />
        ) : null}
      </span>

      <RowMenu
        onEdit={() => setIsEditing(true)}
        onDelete={() => {
          setError(null);
          setDeleteDialogOpen(true);
        }}
        editLabel="Editar"
        deleteLabel="Eliminar"
        isDeleting={isDeleting}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar bloque"
        description={`Se eliminará “${block.title ?? BLOCK_DEFAULT_TITLES[block.type]}” de esta lección. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar bloque"
        destructive
        pending={isDeleting}
        onClose={() => {
          if (!isDeleting) setDeleteDialogOpen(false);
        }}
        onConfirm={async () => {
          const deleteError = await onDelete();
          if (deleteError) setError(deleteError);
          else setDeleteDialogOpen(false);
        }}
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
      </ConfirmDialog>
    </div>
  );
}

export function LessonEditorView({
  course,
  section,
  lesson,
}: {
  course: CourseSummary;
  section: SectionSummary;
  lesson: LessonSummary;
}) {
  const router = useRouter();

  const [blocks, setBlocks] = useState<ContentBlock[]>(lesson.blocks);
  const [isAddPanelOpen, setAddPanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const blockSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [lessonTitle, setLessonTitle] = useState(lesson.title);
  const [titleDraft, setTitleDraft] = useState(lesson.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function handleBlocksSaved(newBlocks: ContentBlock[]) {
    setBlocks(newBlocks);
    router.refresh();
  }

  async function handleDeleteBlock(blockId: string) {
    setIsSaving(true);
    setActionError(null);

    const newBlocks = blocks.filter((block) => block.id !== blockId);
    const result = await updateLessonBlocksAction(lesson.id, newBlocks);

    setIsSaving(false);

    if (result.error) {
      setActionError(result.error);
      return result.error;
    }

    setBlocks(newBlocks);
    router.refresh();
    return null;
  }

  async function handleBlocksDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reordered);

    setActionError(null);
    const result = await updateLessonBlocksAction(lesson.id, reordered);
    if (result.error) {
      setActionError(result.error);
    }
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();

    if (!trimmed || trimmed === lessonTitle) {
      setTitleDraft(lessonTitle);
      setIsEditingTitle(false);
      return;
    }

    setTitleError(null);
    const result = await updateLessonTitleAction(lesson.id, trimmed);

    if (result.error) {
      setTitleError(result.error);
      setTitleDraft(lessonTitle);
      setIsEditingTitle(false);
      return;
    }

    setLessonTitle(trimmed);
    setIsEditingTitle(false);
    router.refresh();
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setTitleDraft(lessonTitle);
      setIsEditingTitle(false);
    }
  }

  async function handleDeleteLesson() {
    setIsDeleting(true);
    setDeleteError(null);

    const result = await deleteLessonAction(lesson.id, course.id);

    setIsDeleting(false);
    if (result?.error) {
      setDeleteError(result.error);
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        <Link
          href={`/admin/cursos/${course.id}`}
          className="hover:underline"
        >
          {course.title}
        </Link>{" "}
        / {section.title}
      </p>

      <div className="mt-2 flex flex-col items-start justify-between gap-4 md:flex-row">
        <div className="flex-1">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={handleTitleKeyDown}
              className="w-full border-b-2 border-foreground bg-transparent text-2xl font-bold tracking-tight outline-none"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className="-mx-1 cursor-text rounded px-1 text-2xl font-bold tracking-tight transition-colors hover:bg-muted"
            >
              {lessonTitle}
            </h1>
          )}
          {titleError ? (
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Error: {titleError}
            </p>
          ) : null}
        </div>

        <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0 md:items-center md:gap-3">
          {course.publicPath ? (
            <a
              href={`${course.publicPath}?lesson=${lesson.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-foreground hover:text-background md:px-5"
            >
              Vista previa ↗
            </a>
          ) : null}

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setDeleteError(null);
              setDeleteDialogOpen(true);
            }}
            disabled={isDeleting}
            className="w-full md:w-auto"
          >
            {isDeleting ? "Eliminando…" : "Eliminar lección"}
          </Button>
        </div>
      </div>

      {deleteError ? (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          Error: {deleteError}
        </p>
      ) : null}

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Eliminar lección"
        description={`Se eliminará “${lessonTitle}” y todo su contenido. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar lección"
        destructive
        pending={isDeleting}
        onClose={() => {
          if (!isDeleting) setDeleteDialogOpen(false);
        }}
        onConfirm={handleDeleteLesson}
      >
        {deleteError ? <Alert variant="error">{deleteError}</Alert> : null}
      </ConfirmDialog>

      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="font-semibold">Contenido de la lección</h2>
          <Badge>{blocks.length} bloques</Badge>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay contenido en esta lección.
            </p>
          ) : (
            <DndContext
              id={`lesson-${lesson.id}-blocks`}
              sensors={blockSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleBlocksDragEnd}
            >
              <SortableContext
                items={blocks.map((block) => block.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((block, index) => (
                  <BlockRow
                    key={block.id}
                    lessonId={lesson.id}
                    blocks={blocks}
                    block={block}
                    index={index}
                    onSaved={handleBlocksSaved}
                    onDelete={() => handleDeleteBlock(block.id)}
                    isDeleting={isSaving}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {actionError ? (
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            Error: {actionError}
          </p>
        ) : null}

        {!isAddPanelOpen && (
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => setAddPanelOpen(true)}
          >
            + Añadir contenido
          </Button>
        )}
      </Card>

      {isAddPanelOpen && (
        <AddContentPanel
          lessonId={lesson.id}
          blocks={blocks}
          onClose={() => setAddPanelOpen(false)}
          onBlocksSaved={handleBlocksSaved}
        />
      )}
    </>
  );
}
