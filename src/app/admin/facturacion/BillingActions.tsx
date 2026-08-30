"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { subscribeAction, openBillingPortalAction } from "./actions";
import type { ActionResult } from "@/types";

const INITIAL: ActionResult = { error: null };

/**
 * `canManage` solo es true si existe una suscripción vigente y un cliente de
 * Stripe. Una empresa cancelada o con datos incompletos vuelve al checkout.
 */
export function BillingActions({
  organizationId,
  canManage,
  status,
  complimentaryWithoutStripe,
}: {
  organizationId: string;
  canManage: boolean;
  status: string;
  complimentaryWithoutStripe: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    canManage ? openBillingPortalAction : subscribeAction,
    INITIAL
  );

  const label = canManage
    ? "Gestionar suscripción"
    : status === "trialing"
      ? "Suscribirse ahora"
      : "Reactivar suscripción";

  if (complimentaryWithoutStripe) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        No tienes que añadir una tarjeta mientras dure este acceso gratuito.
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <form action={formAction}>
        <input type="hidden" name="organizationId" value={organizationId} />
        <button
          type="submit"
          disabled={pending}
          className={buttonClassName(canManage ? "outline" : "primary", "md")}
        >
          {pending ? "Abriendo Stripe…" : label}
        </button>
      </form>

      {state.error && <Alert variant="error">{state.error}</Alert>}
    </div>
  );
}
