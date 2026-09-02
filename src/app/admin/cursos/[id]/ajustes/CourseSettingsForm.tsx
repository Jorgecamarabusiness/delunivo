"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { CourseThumbnail } from "@/components/courses/CourseCard";
import { uploadPublicImage } from "@/lib/storage/uploadLessonMedia";
import { updateCourseSettingsAction } from "./actions";

export type CourseSettings = {
  id: string;
  title: string;
  price: number;
  description: string | null;
  long_description: string | null;
  learning_points: string[] | null;
  thumbnail_url: string | null;
};

export function CourseSettingsForm({ course }: { course: CourseSettings }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [price, setPrice] = useState(String(course.price));
  const [description, setDescription] = useState(course.description ?? "");
  const [longDescription, setLongDescription] = useState(
    course.long_description ?? ""
  );
  const [learningPoints, setLearningPoints] = useState(
    (course.learning_points ?? []).join("\n")
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const result = await uploadPublicImage(file, {
      type: "course",
      id: course.id,
    });
    setUploading(false);

    if (result.error || !result.url) {
      setError(result.error ?? "No se pudo subir la imagen.");
      return;
    }

    setThumbnailUrl(result.url);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.set("courseId", course.id);
    formData.set("title", title);
    formData.set("price", price);
    formData.set("description", description);
    formData.set("longDescription", longDescription);
    formData.set("learningPoints", learningPoints);
    formData.set("thumbnailUrl", thumbnailUrl);

    const result = await updateCourseSettingsAction(formData);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <Field label="Título" htmlFor="title">
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </Field>

      <Field label="Precio (€)" htmlFor="price">
        <Input
          id="price"
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
          className="max-w-[160px]"
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Field
          label="Imagen del curso"
          htmlFor="thumbnail"
          hint="Es la que se ve en el listado y, si lo destacas, en tu portada. Se recomienda formato apaisado (16:9)."
        >
          <input
            id="thumbnail"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="text-sm"
          />
        </Field>

        {uploading && <p className="text-xs text-muted-foreground">Subiendo…</p>}

        <div className="max-w-sm overflow-hidden rounded-lg border border-border">
          <CourseThumbnail
            title={title}
            thumbnailUrl={thumbnailUrl || null}
            className="aspect-video"
          />
        </div>

        {thumbnailUrl && (
          <button
            type="button"
            onClick={() => setThumbnailUrl("")}
            className="self-start text-sm text-red-600 underline"
          >
            Quitar imagen
          </button>
        )}
      </div>

      <Field
        label="Descripción corta"
        htmlFor="description"
        hint="Una o dos líneas. Se ve en las tarjetas del listado y de la portada."
      >
        <Textarea
          id="description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Aprende a montar tu tienda desde cero y a conseguir tus primeras ventas."
        />
      </Field>

      <Field
        label="Descripción completa"
        htmlFor="longDescription"
        hint="El texto largo de la ficha del curso. Deja una línea en blanco entre párrafos."
      >
        <Textarea
          id="longDescription"
          rows={8}
          value={longDescription}
          onChange={(event) => setLongDescription(event.target.value)}
        />
      </Field>

      <Field
        label="Lo que aprenderás"
        htmlFor="learningPoints"
        hint="Un punto por línea."
      >
        <Textarea
          id="learningPoints"
          rows={5}
          value={learningPoints}
          onChange={(event) => setLearningPoints(event.target.value)}
          placeholder={"A elegir producto ganador\nA montar la tienda\nA hacer tu primera venta"}
        />
      </Field>

      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">Cambios guardados.</Alert>}

      <div>
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
