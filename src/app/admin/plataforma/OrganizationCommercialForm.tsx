"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea, inputClassName } from "@/components/ui/Input";
import { ChevronDownIcon } from "@/components/ui/Icons";
import type {
  CommercialAccessMode,
  DiscountDuration,
} from "@/lib/billing/access";
import { updateOrganizationCommercialTermsAction } from "./actions";
import { RunAsButton } from "./RunAsButton";

type OrganizationTerms = {
  id: string;
  name: string;
  slug: string;
  ownerLabel: string;
  ownerUserId: string;
  statusLabel: string;
  statusVariant: "solid" | "outline";
  stripeStatus: string;
  hasStripeSubscription: boolean;
  accessMode: CommercialAccessMode;
  accessExpiresAt: string | null;
  discountPercent: number;
  discountDuration: DiscountDuration;
  effectiveDiscountPercent: number;
  affiliateDiscountCapPercent: number;
  referralWelcomeRemainingPayments: number;
  activeReferrals: number;
  pendingReferrals: number;
  commercialNote: string | null;
  updatedAt: string;
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
    <details className="group min-w-0 rounded-lg border border-border bg-background">
      <summary className="flex min-h-20 list-none flex-col gap-3 rounded-lg p-5 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:flex-row sm:items-center sm:justify-between sm:p-6 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{organization.name}</h3>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            /o/{organization.slug} · {organization.ownerLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={organization.statusVariant}>{organization.statusLabel}</Badge>
          <Badge variant="outline">Stripe: {organization.stripeStatus}</Badge>
          <ChevronDownIcon className="ml-1 h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <form
        ref={formRef}
        className="grid gap-5 border-t border-border p-5 lg:grid-cols-2 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setDialogOpen(true);
        }}
      >
        <input type="hidden" name="expectedUpdatedAt" value={organization.updatedAt} />
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
          label="Descuento manual"
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
          label="Tope total de descuento"
          htmlFor={`discount-cap-${organization.id}`}
          hint="50% es el límite normal. Súbelo solo para una excepción aprobada, por ejemplo Sata."
        >
          <div className="flex items-center gap-3">
            <Input
              id={`discount-cap-${organization.id}`}
              name="affiliateDiscountCapPercent"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={organization.affiliateDiscountCapPercent}
              className="max-w-28"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
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
          <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Descuento efectivo</p>
              <p className="mt-1 text-lg font-semibold">
                {organization.effectiveDiscountPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Referidos</p>
              <p className="mt-1 text-sm font-semibold">
                {organization.activeReferrals} pagando · {organization.pendingReferrals} pendientes
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bienvenida</p>
              <p className="mt-1 text-sm font-semibold">
                {organization.referralWelcomeRemainingPayments} mensualidades restantes
              </p>
            </div>
          </div>
        </div>

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

      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Abre la cuenta del propietario para reproducir una incidencia.
        </p>
        <RunAsButton
          targetUserId={organization.ownerUserId}
          targetName={organization.ownerLabel}
        />
      </div>

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
    </details>
  );
}
