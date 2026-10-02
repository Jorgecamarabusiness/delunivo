"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Input";
import { PLANS, OFFER_VERSION } from "@/lib/billing/catalog";
import { formatPlatformPrice } from "@/lib/billing/access";
import {
  purchaseCapacityAction,
  previewCapacityAction,
  confirmCapacityAction,
  type CapacityActionState,
} from "./capacityActions";
const initial: CapacityActionState = { error: null };
function Acceptance() {
  return (
    <>
      <input name="offerVersion" type="hidden" value={OFFER_VERSION} />
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-1 h-5 w-5 shrink-0"
          type="checkbox"
          name="acceptOffer"
          value="yes"
          required
        />
        <span>
          Acepto esta oferta, su renovación indicada y las{" "}
          <Link href="/condiciones-planes" className="underline">
            condiciones de planes y conservación
          </Link>{" "}
          (versión {OFFER_VERSION}).
        </span>
      </label>
    </>
  );
}
function FiscalDomicileFields() {
  return <fieldset className="space-y-4 rounded-lg border border-border p-4">
    <legend className="px-1 text-sm font-semibold">Domicilio fiscal de la escuela</legend>
    <p className="text-sm text-muted-foreground">Piloto en España, solo Península y Baleares. Precios con el 21 % de IVA incluido. Estos datos se guardan en Stripe para la facturación.</p>
    <input type="hidden" name="fiscalCountry" value="ES" />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium sm:col-span-2">Nombre o razón social
        <input className={`${inputClassName} mt-2`} name="fiscalName" autoComplete="organization" maxLength={200} required />
      </label>
      <label className="text-sm font-medium sm:col-span-2">Dirección fiscal
        <input className={`${inputClassName} mt-2`} name="fiscalLine1" autoComplete="address-line1" maxLength={200} required />
      </label>
      <label className="text-sm font-medium">Localidad
        <input className={`${inputClassName} mt-2`} name="fiscalCity" autoComplete="address-level2" maxLength={100} required />
      </label>
      <label className="text-sm font-medium">Código postal
        <input className={`${inputClassName} mt-2`} name="fiscalPostalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required />
      </label>
    </div>
    <label className="flex items-start gap-3 text-sm">
      <input className="mt-1 h-5 w-5 shrink-0" type="checkbox" name="acceptFiscalScope" value="yes" required />
      <span>Confirmo que este es el domicilio fiscal de la escuela y que se encuentra en Península o Baleares, España.</span>
    </label>
  </fieldset>;
}
export function CapacityControls({
  organizationId,
  planKey,
  libraryQuantity,
  subscriptionActive,
  enabled,
  fiscalScopeRequired = false,
}: {
  organizationId: string;
  planKey: string | null;
  libraryQuantity: number;
  subscriptionActive: boolean;
  enabled: boolean;
  fiscalScopeRequired?: boolean;
}) {
  const [purchase, buyAction, buying] = useActionState(
    purchaseCapacityAction,
    initial,
  );
  const [preview, previewAction, previewing] = useActionState(
    previewCapacityAction,
    initial,
  );
  const [confirmed, confirmAction, confirming] = useActionState(
    confirmCapacityAction,
    initial,
  );
  const plan = PLANS.find((p) => p.key === planKey);
  if (!enabled)
    return (
      <Alert variant="info">
        Las nuevas operaciones comerciales están pendientes de activación. Tu
        oferta vigente se conserva.
      </Alert>
    );
  return (
    <div className="space-y-6">
      {!subscriptionActive ? (
        <form action={buyAction} className="space-y-4">
          <input type="hidden" name="organizationId" value={organizationId} />
          <label className="block text-sm font-medium">
            Elige tu plan
            <select
              name="planKey"
              className={`${inputClassName} mt-2`}
              defaultValue="crece"
            >
              {PLANS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} · {formatPlatformPrice(p.priceCents)}/mes, impuestos
                  incluidos
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            El pago inicia la suscripción mensual con renovación automática. La
            prueba no se convierte automáticamente en una suscripción.
          </p>
          {fiscalScopeRequired ? <FiscalDomicileFields /> : null}
          <Acceptance />
          <button
            disabled={buying}
            className={buttonClassName("primary", "md")}
          >
            {buying ? "Abriendo pago…" : "Contratar el plan"}
          </button>
        </form>
      ) : plan ? (
        <>
          <form action={buyAction} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="planKey" value="delivery_pack" />
            <h3 className="font-semibold">Bolsa de 5.000 minutos · 20 €</h3>
            <p className="text-sm text-muted-foreground">
              Pago único, impuestos incluidos. Vence 90 días después del pago
              confirmado. Sin renovación automática.
            </p>
            {fiscalScopeRequired ? <p className="text-sm text-muted-foreground">Se utiliza el domicilio fiscal confirmado de la escuela en Península o Baleares, con el 21 % de IVA incluido.</p> : null}
            <Acceptance />
            <button
              disabled={buying}
              className={buttonClassName("outline", "md")}
            >
              {buying ? "Abriendo pago…" : "Comprar bolsa"}
            </button>
          </form>
          <form action={previewAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="organizationId" value={organizationId} />
            <label className="text-sm font-medium">
              Plan
              <select
                className={`${inputClassName} mt-2`}
                name="planKey"
                defaultValue={plan.key}
              >
                {PLANS.map((p) => (
                  <option value={p.key} key={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Bloques de biblioteca (+10 h por bloque)
              <input
                className={`${inputClassName} mt-2`}
                name="libraryQuantity"
                type="number"
                min={0}
                max={100}
                defaultValue={libraryQuantity}
                required
              />
            </label>
            <label className="text-sm font-medium">
              Operación
              <select className={`${inputClassName} mt-2`} name="kind">
                <option value="library">
                  Cambiar ampliaciones de biblioteca
                </option>
                <option value="upgrade">Aumentar plan</option>
                <option value="downgrade">
                  Reducir plan en la próxima renovación
                </option>
                <option value="cancel">
                  Cancelar al final del periodo pagado
                </option>
                <option value="resume">
                  Mantener la suscripción / cancelar cambio programado
                </option>
              </select>
            </label>
            <button
              disabled={previewing}
              className={buttonClassName("outline", "md", "self-end")}
            >
              {previewing ? "Calculando…" : "Previsualizar cambio"}
            </button>
          </form>
        </>
      ) : (
        <Alert variant="info">
          Tu contrato anterior se mantiene. Su transición a un plan nuevo
          requiere una oferta expresa; puedes seguir gestionando la suscripción
          vigente.
        </Alert>
      )}
      {preview.quote ? (
        <form
          action={confirmAction}
          className="space-y-4 rounded-lg border border-border p-4"
        >
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="operationId" value={preview.quote.id} />
          <h3 className="font-semibold">Revisa el cambio antes de confirmar</h3>
          <p>
            Pago inicial:{" "}
            <strong>{formatPlatformPrice(preview.quote.initialCents)}</strong>.{" "}
            {preview.quote.kind !== "cancel" ? (
              <>
                Precio recurrente con el descuento actual:{" "}
                <strong>
                  {formatPlatformPrice(preview.quote.recurringCents)}/mes
                </strong>
                .
              </>
            ) : (
              "La cancelación no devuelve automáticamente el periodo ya pagado."
            )}
          </p>
          <p className="text-sm">
            Fecha de renovación / efecto de reducción:{" "}
            {new Date(preview.quote.cycleEnd).toLocaleString("es-ES", {
              timeZone: "Europe/Madrid",
            })}
            .
          </p>
          <p className="text-xs text-muted-foreground">
            El prorrateo del cobro y capacidad usa el instante de cálculo{" "}
            {new Date(preview.quote.prorationAt).toLocaleString("es-ES", {
              timeZone: "Europe/Madrid",
            })}
            . La capacidad se activa tras pago confirmado. Los descuentos
            conservan su duración y no se extienden a las ampliaciones.
          </p>
          <Acceptance />
          <button
            disabled={confirming}
            className={buttonClassName("primary", "md")}
          >
            {confirming ? "Confirmando…" : "Confirmar esta oferta"}
          </button>
        </form>
      ) : null}
      {[purchase.error, preview.error, confirmed.error]
        .filter(Boolean)
        .map((error, i) => (
          <Alert key={i} variant="error">
            {error}
          </Alert>
        ))}
      {confirmed.message ? (
        <Alert variant="success">{confirmed.message}</Alert>
      ) : null}
    </div>
  );
}
