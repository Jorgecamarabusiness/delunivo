"use client";

import Link from "next/link";
import { useState } from "react";
import type { VideoBlock as VideoBlockType } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getAllowedEmbed, getSafeExternalUrl } from "@/lib/embedUrl";

export function VideoBlock({ block }: { block: VideoBlockType }) {
  const [loaded, setLoaded] = useState(false);
  const allowed = getAllowedEmbed(block.video_url);
  const externalUrl = getSafeExternalUrl(block.video_url);

  if (!allowed) {
    return (
      <Card className="flex aspect-video w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">Este contenido no se puede cargar dentro de Delunivo.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          El proveedor no forma parte de la lista de vídeo integrada. Conservamos el enlace sin cargar recursos de terceros aquí.
        </p>
        {externalUrl ? (
          <Link href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4">
            Abrir contenido en una pestaña nueva ↗
          </Link>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="aspect-video w-full overflow-hidden">
      {loaded ? (
        <iframe
          src={allowed.embedUrl}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          title={block.title ?? `Vídeo de ${allowed.provider}`}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm font-medium">Vídeo alojado en {allowed.provider}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Al cargarlo, {allowed.provider} puede recibir datos de tu navegador.
          </p>
          <Button type="button" variant="primary" onClick={() => setLoaded(true)}>
            Cargar vídeo
          </Button>
        </div>
      )}
    </Card>
  );
}
