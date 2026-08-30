"use client";

import { useState } from "react";
import type { ContentBlock } from "@/types";
import { updateLessonBlocksAction } from "@/app/admin/cursos/[id]/lecciones/[lessonId]/actions";
import { BlockTypeIcon, BLOCK_LABELS } from "@/components/lesson-blocks/blockMeta";
import { TextBlockForm } from "@/components/lesson-blocks/forms/TextBlockForm";
import { EmbedMediaForm } from "@/components/lesson-blocks/forms/EmbedMediaForm";
import { VideoFileForm } from "@/components/lesson-blocks/forms/VideoFileForm";

type PanelStep = "choose" | "video" | "video_file" | "text";

const CONTENT_TYPES: Array<{
  key: "video_file" | "video" | "text" | "pdf" | "audio" | "image" | "quiz";
  label: string;
  enabled: boolean;
}> = [
  { key: "video_file", label: BLOCK_LABELS.video_file, enabled: true },
  { key: "video", label: BLOCK_LABELS.video, enabled: true },
  { key: "text", label: BLOCK_LABELS.text, enabled: true },
  { key: "pdf", label: "PDF", enabled: false },
  { key: "audio", label: "Audio", enabled: false },
  { key: "image", label: "Imagen/Banner", enabled: false },
  { key: "quiz", label: "Quiz", enabled: false },
];

export function AddContentPanel({
  lessonId,
  blocks,
  onClose,
  onBlocksSaved,
}: {
  lessonId: string;
  blocks: ContentBlock[];
  onClose: () => void;
  onBlocksSaved: (blocks: ContentBlock[]) => void;
}) {
  const [step, setStep] = useState<PanelStep>("choose");
  const [videoBlockId] = useState(() => crypto.randomUUID());
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function persist(newBlocks: ContentBlock[]) {
    setIsSaving(true);
    setActionError(null);

    const result = await updateLessonBlocksAction(lessonId, newBlocks);

    setIsSaving(false);

    if (result.error) {
      setActionError(result.error);
      return;
    }

    onBlocksSaved(newBlocks);
    onClose();
  }

  return (
    <div className="mt-6 rounded-lg border border-border p-6">
      {step === "choose" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Añadir contenido</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                disabled={!type.enabled}
                onClick={() => {
                  if (
                    type.key === "video" ||
                    type.key === "video_file" ||
                    type.key === "text"
                  ) {
                    setStep(type.key);
                  }
                }}
                className={
                  type.enabled
                    ? "flex flex-col items-center gap-2 rounded-md border border-border p-6 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
                    : "flex cursor-not-allowed flex-col items-center gap-1 rounded-md border border-border p-6 text-sm font-medium text-muted-foreground opacity-50"
                }
              >
                {type.key === "video" || type.key === "video_file" || type.key === "text" ? (
                  <BlockTypeIcon type={type.key} className="h-6 w-6" />
                ) : (
                  <span className="text-xl">▤</span>
                )}
                {type.label}
                {!type.enabled ? (
                  <span className="text-[10px] font-normal uppercase tracking-wide">
                    Próximamente
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "video" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Añadir {BLOCK_LABELS.video.toLowerCase()}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="mt-6">
            <EmbedMediaForm
              onCancel={onClose}
              isSaving={isSaving}
              error={actionError}
              submitLabel="Añadir"
              onSubmit={(title, url) =>
                persist([
                  ...blocks,
                  { id: crypto.randomUUID(), type: "video", title, video_url: url },
                ])
              }
            />
          </div>
        </>
      )}

      {step === "video_file" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Añadir {BLOCK_LABELS.video_file.toLowerCase()}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="mt-6">
            <VideoFileForm
              lessonId={lessonId}
              blockId={videoBlockId}
              onCancel={onClose}
              isSaving={isSaving}
              error={actionError}
              submitLabel="Añadir"
              onSubmit={(title, selection) =>
                persist([
                  ...blocks,
                  selection.muxVideoAssetId
                    ? {
                        id: videoBlockId,
                        type: "video_file",
                        title,
                        mux_video_asset_id: selection.muxVideoAssetId,
                      }
                    : {
                        id: videoBlockId,
                        type: "video_file",
                        title,
                        video_url: selection.legacyUrl,
                      },
                ])
              }
            />
          </div>
        </>
      )}

      {step === "text" && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Añadir {BLOCK_LABELS.text.toLowerCase()}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="text-lg leading-none text-muted-foreground transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="mt-6">
            <TextBlockForm
              onCancel={onClose}
              isSaving={isSaving}
              error={actionError}
              submitLabel="Añadir"
              onSubmit={(title, content) =>
                persist([
                  ...blocks,
                  { id: crypto.randomUUID(), type: "text", title, content },
                ])
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
