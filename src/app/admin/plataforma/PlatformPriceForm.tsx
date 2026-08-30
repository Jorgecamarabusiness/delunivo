"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { updatePlatformPriceAction } from "./actions";

export function PlatformPriceForm({ priceCents }: { priceCents: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="mt-5 max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const data = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updatePlatformPriceAction({ error: null }, data);
          if (result.error) setError(result.error);
          else {
            setSaved(true);
            router.refresh();
          }
        });
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field
            label="Precio mensual"
            htmlFor="monthlyPrice"
            hint="Se aplicará a las nuevas suscripciones. Las ya creadas conservan el precio acordado en Stripe."
          >
            <div className="relative">
              <Input
                id="monthlyPrice"
                name="monthlyPrice"
                type="number"
                min="1"
                max="10000"
                step="0.01"
                defaultValue={(priceCents / 100).toFixed(2)}
                className="pr-10"
                required
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                €
              </span>
            </div>
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar precio"}
        </Button>
      </div>
      {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}
      {saved ? <Alert variant="success" className="mt-4">Precio actualizado.</Alert> : null}
    </form>
  );
}
