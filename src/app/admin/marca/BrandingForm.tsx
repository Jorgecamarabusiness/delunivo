"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, inputClassName } from "@/components/ui/Input";
import { uploadPublicImage } from "@/lib/storage/uploadLessonMedia";
import { updateBrandingAction } from "./actions";
import { BrandLogo } from "@/components/media/PublicImages";

type Organization = {
  name: string;
  tagline_template: string | null;
  hero_subtitle: string | null;
  featured_course_id: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

export type CourseOption = { id: string; title: string };

export function BrandingForm({
  organization,
  courses,
  ownerName,
}: {
  organization: Organization;
  courses: CourseOption[];
  ownerName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [taglineTemplate, setTaglineTemplate] = useState(
    organization.tagline_template
      ? organization.tagline_template.replaceAll("{admin}", ownerName)
      : `Aprende junto a cientos de alumnos con ${ownerName}`
  );
  const [heroSubtitle, setHeroSubtitle] = useState(
    organization.hero_subtitle ?? ""
  );
  const [featuredCourseId, setFeaturedCourseId] = useState(
    organization.featured_course_id ?? ""
  );
  const [primaryColor, setPrimaryColor] = useState(
    organization.primary_color ?? "#16a34a"
  );
  const [logoUrl, setLogoUrl] = useState(organization.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const result = await uploadPublicImage(file, { type: "brand" });
    setUploading(false);

    if (result.error || !result.url) {
      setError(result.error ?? "No se pudo subir el logo.");
      return;
    }

    setLogoUrl(result.url);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("taglineTemplate", taglineTemplate);
    formData.set("heroSubtitle", heroSubtitle);
    formData.set("featuredCourseId", featuredCourseId);
    formData.set("primaryColor", primaryColor);
    formData.set("logoUrl", logoUrl);

    const result = await updateBrandingAction(formData);
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
      <Field label="Nombre" htmlFor="name">
        <Input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </Field>

      <Field
        label="Titular de tu página de inicio"
        htmlFor="tagline"
        hint="El texto grande de tu portada. Tu nombre aparece automáticamente la primera vez; después puedes cambiarlo como quieras."
      >
        <Input
          id="tagline"
          value={taglineTemplate}
          onChange={(event) => setTaglineTemplate(event.target.value)}
          placeholder={`Aprende junto a cientos de alumnos con ${ownerName}`}
        />
      </Field>

      <Field
        label="Frase de apoyo"
        htmlFor="heroSubtitle"
        hint="Va debajo del titular, en letra más pequeña. Opcional."
      >
        <Input
          id="heroSubtitle"
          value={heroSubtitle}
          onChange={(event) => setHeroSubtitle(event.target.value)}
          placeholder="Todo lo que necesitas para empezar a vender desde cero."
        />
      </Field>

      <Field
        label="Curso destacado"
        htmlFor="featuredCourse"
        hint="Es el que protagoniza tu portada, con su imagen y su precio. Si no eliges ninguno, se usa el más antiguo."
      >
        <select
          id="featuredCourse"
          value={featuredCourseId}
          onChange={(event) => setFeaturedCourseId(event.target.value)}
          className={inputClassName}
        >
          <option value="">El más antiguo (automático)</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </Field>

      {courses.length === 0 && (
        <Alert variant="info">
          Todavía no tienes ningún curso publicado, así que tu portada aparecerá
          sin cursos. Publica uno desde &quot;Cursos&quot;.
        </Alert>
      )}

      <div className="flex items-end gap-4">
        <Field label="Logo" htmlFor="logo">
          <input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleLogoChange}
            className="text-sm"
          />
          {uploading && (
            <p className="text-xs text-muted-foreground">Subiendo…</p>
          )}
        </Field>
        <BrandLogo
          src={logoUrl || null}
          name={name}
          className="h-12 w-12 border border-border"
        />
      </div>

      <Field
        label="Color principal"
        htmlFor="color"
        hint="Se usa en los botones y detalles de tu portal. El texto de encima se ajusta solo a negro o blanco para que siempre se lea."
      >
        <input
          id="color"
          type="color"
          value={primaryColor}
          onChange={(event) => setPrimaryColor(event.target.value)}
          className="h-10 w-20 rounded-md border border-border"
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
