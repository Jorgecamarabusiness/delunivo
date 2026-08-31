import type { TextBlock as TextBlockType } from "@/types";
import { Card } from "@/components/ui/Card";
import { sanitizeLessonHtml } from "@/lib/content/sanitizeLessonHtml";

export function TextBlock({ block }: { block: TextBlockType }) {
  const html = sanitizeLessonHtml(block.content);

  return (
    <Card className="p-6">
      {block.title ? (
        <h3 className="text-sm font-semibold">{block.title}</h3>
      ) : null}
      <div
        className="mt-2 overflow-hidden break-words text-sm leading-relaxed text-foreground/80 [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Card>
  );
}
