import type { VideoFileBlock as VideoFileBlockType } from "@/types";
import { Card } from "@/components/ui/Card";
import { MuxVideoBlock } from "@/components/lesson-blocks/MuxVideoBlock";

export function VideoFileBlock({ block }: { block: VideoFileBlockType }) {
  if (block.mux_video_asset_id) {
    return <MuxVideoBlock videoAssetId={block.mux_video_asset_id} title={block.title} />;
  }

  return (
    <Card className="aspect-video w-full overflow-hidden">
      {block.video_url ? (
        <video controls className="h-full w-full bg-muted" src={block.video_url} />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Vídeo no disponible.
        </div>
      )}
    </Card>
  );
}
