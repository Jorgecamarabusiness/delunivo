"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, inputClassName } from "@/components/ui/Input";
import { uploadPublicImage } from "@/lib/storage/uploadLessonMedia";
import {
  checkSlugAvailabilityAction,
  updateBrandingAction,
  type SlugAvailabilityResult,
} from "./actions";
import { BrandLogo } from "@/components/media/PublicImages";
import {
  slugify,
  validateOrganizationSlug,
} from "@/lib/organizations/slug";

type Organization = {
  name: string;
  slug: string;
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
  siteOrigin,
}: {
  organization: Organization;
  courses: CourseOption[];
  ownerName: string;
  siteOrigin: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [slug, setSlug] = useState(organization.slug);
  const [savedSlug, setSavedSlug] = useState(organization.slug);
  const [slugStatus, setSlugStatus] = useState<
    SlugAvailabilityResult | { status: "checking"; slug: string; message: string }
  >({ status: "current", slug: organization.slug, message: "Este es tu enlace actual." });
  const slugRequest = useRef(0);
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
    organization.primary_color ?? "#4f46e5"
  );
  const [logoUrl, setLogoUrl] = useState(organization.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = `${siteOrigin}/o/${savedSlug}`;
  const slugCanBeSaved =
    slug === savedSlug ||
    slugStatus.status === "available" ||
    slugStatus.status === "current";

  useEffect(() => {
    const validation = validateOrganizationSlug(slug);
    if (!validation.ok || validation.slug === savedSlug) return;
    const requestId = slugRequest.current;

    const timer = window.setTimeout(async () => {
      try {
        const result = await checkSlugAvailabilityAction(validation.slug);
        if (slugRequest.current === requestId) setSlugStatus(result);
      } catch {
        if (slugRequest.current === requestId) {
          setSlugStatus({
            status: "error",
            slug: validation.slug,
            message: "No se pudo comprobar el enlace. Inténtalo de nuevo.",
          });
        }
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [savedSlug, slug]);

  function handleSlugChange(value: string) {
    const nextSlug = slugify(value).slice(0, 63);
    const validation = validateOrganizationSlug(nextSlug);
    slugRequest.current += 1;
    setSlug(nextSlug);
    setSaved(false);

    if (!validation.ok) {
      setSlugStatus({
        status: "invalid",
        slug: validation.slug,
        message: validation.error,
      });
    } else if (validation.slug === savedSlug) {
      setSlugStatus({
        status: "current",
        slug: validation.slug,
        message: "Este es tu enlace actual.",
      });
    } else {
      setSlugStatus({
        status: "checking",
        slug: validation.slug,
        message: "Comprobando disponibilidad…",
      });
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("No se pudo copiar el enlace. Puedes seleccionarlo manualmente.");
    }
  }

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
    if (!slugCanBeSaved || slugStatus.status === "checking") {
      setError("Elige un enlace disponible antes de guardar.");
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);
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

    const nextSlug = result.slug ?? slug;
    setSlug(nextSlug);
    setSavedSlug(nextSlug);
    setSlugStatus({
      status: "current",
      slug: nextSlug,
      message: "Este es tu enlace actual.",
    });
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
        <Field
          label="Enlace de tu escuela"
          htmlFor="slug"
          hint={
            <span id="slug-hint">
              Elige la parte que aparece después de /o/. Si la cambias, el enlace anterior dejará de funcionar.
            </span>
          }
        >
          <div className="flex min-w-0 items-stretch rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-accent">
            <span className="hidden shrink-0 items-center border-r border-border px-3 text-sm text-muted-foreground sm:flex">
              /o/
            </span>
            <Input
              id="slug"
              value={slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              maxLength={63}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="slug-hint slug-status"
              className="border-0 focus:ring-0"
              required
            />
          </div>
          <p
            id="slug-status"
            aria-live="polite"
            className={`text-xs ${
              slugStatus.status === "available"
                ? "text-green-700"
                : slugStatus.status === "taken" ||
                    slugStatus.status === "invalid" ||
                    slugStatus.status === "error"
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {slugStatus.message}
          </p>
        </Field>

        <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all rounded-md bg-background px-3 py-2 text-xs text-muted-foreground">
            {publicUrl}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? "Copiado ✓" : "Copiar enlace"}
          </Button>
        </div>
      </section>

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
        <Button
          type="submit"
          disabled={
            pending || uploading || !slugCanBeSaved || slugStatus.status === "checking"
          }
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
