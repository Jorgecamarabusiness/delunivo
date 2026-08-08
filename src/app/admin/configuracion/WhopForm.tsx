"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { saveWhopCredentialsAction } from "./actions";

export function WhopForm({
  hasWhopKey,
  whopProductId,
}: {
  hasWhopKey: boolean;
  whopProductId: string;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [productId, setProductId] = useState(whopProductId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.set("apiKey", apiKey);
    formData.set("productId", productId);

    const result = await saveWhopCredentialsAction(formData);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setApiKey("");
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {hasWhopKey
          ? "Ya tienes una API key de Whop configurada. Pega una nueva aquí para reemplazarla."
          : "Pega tu API key de Whop (Settings → Developer → API Keys en tu dashboard de Whop) y el ID del producto que quieres validar."}
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="apiKey">
          API key de Whop
        </label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={hasWhopKey ? "••••••••••••" : "apik_..."}
          required
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium" htmlFor="productId">
          ID del producto
        </label>
        <input
          id="productId"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          placeholder="prod_..."
          required
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando..." : "Guardar"}
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
