/**
 * Resultado estándar de una server action que la UI pinta con `useActionState`:
 * `error: null` es éxito. Se prefiere esto a `throw` en cualquier action que se
 * dispare desde un formulario — un throw sin capturar acaba en la pantalla
 * genérica de error de Next, sin mensaje útil para el usuario.
 */
export type ActionResult = { error: string | null };

export type CourseStatus = "published" | "draft";

export interface Section {
  id: string;
  courseId: string;
  title: string;
  order: number;
  status: CourseStatus;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  sectionId: string;
  courseId: string;
  title: string;
  duration: number;
  order: number;
  isPreview: boolean;
  status: CourseStatus;
  blocks: ContentBlock[];
}

export interface VideoBlock {
  id: string;
  type: "video";
  title?: string;
  video_url: string;
}

export interface VideoFileBlock {
  id: string;
  type: "video_file";
  title?: string;
  /** Ruta de Supabase Storage para vídeos heredados. */
  video_url?: string;
  /** ID interno de public.video_assets para los vídeos privados de Mux. */
  mux_video_asset_id?: string;
}

export interface TextBlock {
  id: string;
  type: "text";
  title?: string;
  content: string;
}

export type ContentBlock = VideoBlock | VideoFileBlock | TextBlock;
