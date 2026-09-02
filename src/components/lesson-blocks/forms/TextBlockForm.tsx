"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RichTextEditor } from "@/components/lesson-blocks/RichTextEditor";
import { uploadPublicImage } from "@/lib/storage/uploadLessonMedia";

function isContentEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export function TextBlockForm({
  lessonId,
  initialTitle = "",
  initialContent = "",
  onCancel,
  onSubmit,
  isSaving,
  error,
  submitLabel,
}: {
  lessonId: string;
  initialTitle?: string;
  initialContent?: string;
  onCancel: () => void;
  onSubmit: (title: string, content: string) => void;
  isSaving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);

  async function handleUploadImage(file: File) {
    const result = await uploadPublicImage(file, { type: "lesson", id: lessonId });
    return result.url;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || isContentEmpty(content)) return;
        onSubmit(title.trim(), content);
      }}
    >
      <label className="block text-xs font-medium text-muted-foreground">
        Título
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground"
          placeholder="Ej. Resumen de la lección"
        />
      </label>

      <div className="mt-4">
        <span className="block text-xs font-medium text-muted-foreground">
          Contenido
        </span>
        <div className="mt-1">
          <RichTextEditor
            value={content}
            onChange={setContent}
            onUploadImage={handleUploadImage}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Error: {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!title.trim() || isContentEmpty(content) || isSaving}
        >
          {isSaving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
