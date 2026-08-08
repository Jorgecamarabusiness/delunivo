"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadLessonMedia } from "@/lib/storage/uploadLessonMedia";
import { updateBrandingAction } from "./actions";

type Organization = {
  name: string;
  tagline_template: string | null;
  logo_url: string | null;
  primary_color: string | null;
};

export function BrandingForm({ organization }: { organization: Organization }) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [taglineTemplate, setTaglineTemplate] = useState(
    organization.tagline_template ?? ""
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
    const result = await uploadLessonMedia(file, "images");
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="rounded-md border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="tagline">
          Mensaje de bienvenida
        </label>
        <input
          id="tagline"
          value={taglineTemplate}
          onChange={(event) => setTaglineTemplate(event.target.value)}
          placeholder="Aprende dropshipping orgánico junto a cientos de usuarios con {admin}"
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
        <p className="text-xs text-muted-foreground">
          Se muestra en grande en tu página de inicio. Usa {"{admin}"} donde
          quieras que aparezca tu nombre.
        </p>
      </div>

      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="logo">
            Logo
          </label>
          <input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleLogoChange}
            className="text-sm"
          />
          {uploading && (
            <p className="text-xs text-muted-foreground">Subiendo...</p>
          )}
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-12 w-12 rounded-full border border-border object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="color">
          Color principal
        </label>
        <input
          id="color"
          type="color"
          value={primaryColor}
          onChange={(event) => setPrimaryColor(event.target.value)}
          className="h-10 w-20 rounded-md border border-border"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {saved && <p className="text-sm text-muted-foreground">Guardado.</p>}
        {error && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
