"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getAllowedEmbed } from "@/lib/embedUrl";

export function EmbedMediaForm({
  initialTitle = "",
  initialUrl = "",
  onCancel,
  onSubmit,
  isSaving,
  error,
  submitLabel,
}: {
  initialTitle?: string;
  initialUrl?: string;
  onCancel: () => void;
  onSubmit: (title: string, url: string) => void;
  isSaving: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  const allowedEmbed = getAllowedEmbed(url.trim());

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !url.trim()) return;
        onSubmit(title.trim(), url.trim());
      }}
    >
      <label className="block text-xs font-medium text-muted-foreground">
        Título
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground"
          placeholder="Ej. Bienvenida al curso"
        />
      </label>

      <label className="mt-4 block text-xs font-medium text-muted-foreground">
        URL de vídeo (YouTube o Vimeo)
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm text-foreground"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </label>

      {url.trim() && !allowedEmbed ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Solo YouTube y Vimeo se cargan dentro del aula. Esta URL se conservará
          como enlace externo seguro si la guardas.
        </p>
      ) : null}

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
          disabled={!title.trim() || !url.trim() || isSaving}
        >
          {isSaving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
