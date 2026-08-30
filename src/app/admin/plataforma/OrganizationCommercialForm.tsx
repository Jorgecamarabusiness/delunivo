"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea, inputClassName } from "@/components/ui/Input";
import type {
  CommercialAccessMode,
  DiscountDuration,
} from "@/lib/billing/access";
import { updateOrganizationCommercialTermsAction } from "./actions";

type OrganizationTerms = {
  id: string;
  name: string;
  slug: string;
  ownerLabel: string;
  statusLabel: string;
  statusVariant: "solid" | "outline";
  stripeStatus: string;
  hasStripeSubscription: boolean;
  accessMode: CommercialAccessMode;
  accessExpiresAt: string | null;
  discountPercent: number;
  discountDuration: DiscountDuration;
  commercialNote: string | null;
};

function dateValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function OrganizationCommercialForm({ organization }: { organization: OrganizationTerms }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [accessMode, setAccessMode] = useState<CommercialAccessMode>(
    organization.accessMode
  );
  const [accessExpiresOn, setAccessExpiresOn] = useState(
    dateValue(organization.accessExpiresAt)
  );

  const confirmation = organization.hasStripeSubscription
    ? "El cambio también se aplicará a su suscripción real de Stripe. Si terminas una prueba, Stripe podría cobrar la siguiente factura."
    : "El acceso y la oferta quedarán guardados para esta empresa. Si se suscribe después, Stripe usará estas condiciones.";

  function save() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateOrganizationCommercialTermsAction(
        organization.id,
        data
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <article className="min-w-0 rounded-lg border border-border p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{organization.name}</h3>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            /o/{organization.slug} · {organization.ownerLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={organization.statusVariant}>{organization.statusLabel}</Badge>
          <Badge variant="outline">Stripe: {organization.stripeStatus}</Badge>
        </div>
      </div>

      <form
        ref={formRef}
        className="mt-6 grid gap-5 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setDialogOpen(true);
        }}
      >
        <Field
          label="Acceso a Delunivo"
          htmlFor={`access-${organization.id}`}
          hint="Normal exige una suscripción; Invitada gratis no cobra; Prueba abre el panel hasta la fecha elegida."
        >
          <select
            id={`access-${organization.id}`}
            name="accessMode"
            value={accessMode}
            onChange={(event) =>
              setAccessMode(event.target.value as CommercialAccessMode)
            }
            className={inputClassName}
          >
            <option value="standard">Cobro normal</option>
            <option value="complimentary">Invitada gratis</option>
            <option value="trial">Prueba gratuita</option>
          </select>
        </Field>

        {accessMode === "trial" ? (
          <Field
            label="Fin de la prueba"
            htmlFor={`expiry-${organization.id}`}
            hint="Obligatorio. Al terminar necesitará una suscripción activa."
          >
            <Input
              id={`expiry-${organization.id}`}
              name="accessExpiresOn"
              type="date"
              min={futureDate(1)}
              value={accessExpiresOn}
              onChange={(event) => setAccessExpiresOn(event.target.value)}
              required={accessMode === "trial"}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setAccessExpiresOn(futureDate(days))}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {days} días
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <input type="hidden" name="accessExpiresOn" value="" />
        )}

        <Field
          label="Descuento"
          htmlFor={`discount-${organization.id}`}
          hint={
            accessMode === "complimentary"
              ? "No hace falta: esta empresa ya tiene acceso gratuito."
              : "0% significa sin descuento. Se aplicará al próximo checkout o a la suscripción actual."
          }
        >
          <div className="flex items-center gap-3">
            <Input
              id={`discount-${organization.id}`}
              name="discountPercent"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={organization.discountPercent}
              disabled={accessMode === "complimentary"}
              className="max-w-28"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          {accessMode === "complimentary" ? (
            <input type="hidden" name="discountPercent" value="0" />
          ) : null}
        </Field>

        <Field
          label="Duración del descuento"
          htmlFor={`duration-${organization.id}`}
          hint="Primer mes descuenta únicamente la primera factura mensual."
        >
          <select
            id={`duration-${organization.id}`}
            name="discountDuration"
            defaultValue={organization.discountDuration}
            disabled={accessMode === "complimentary"}
            className={inputClassName}
          >
            <option value="once">Solo el primer mes</option>
            <option value="forever">Todos los meses</option>
          </select>
          {accessMode === "complimentary" ? (
            <input type="hidden" name="discountDuration" value="once" />
          ) : null}
        </Field>

        <div className="lg:col-span-2">
          <Field
            label="Nota interna"
            htmlFor={`note-${organization.id}`}
            hint="Solo la ven los superadministradores. Explica quién aprobó la condición y por qué."
          >
            <Textarea
              id={`note-${organization.id}`}
              name="commercialNote"
              rows={3}
              maxLength={1000}
              defaultValue={organization.commercialNote ?? ""}
              placeholder="Ej. Colaborador invitado durante el lanzamiento"
            />
          </Field>
        </div>

        <div className="flex flex-col items-start gap-3 lg:col-span-2 sm:flex-row sm:items-center">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar condiciones"}
          </Button>
          {saved ? <span className="text-sm font-medium text-green-700">Guardado.</span> : null}
        </div>
      </form>

      <ConfirmDialog
        open={dialogOpen}
        title={`Actualizar condiciones de ${organization.name}`}
        description={confirmation}
        confirmLabel="Confirmar cambios"
        pending={pending}
        onClose={() => {
          if (!pending) setDialogOpen(false);
        }}
        onConfirm={save}
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
      </ConfirmDialog>
    </article>
  );
}
