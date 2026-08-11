"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { subscribeAction, openBillingPortalAction } from "./actions";
import type { ActionResult } from "@/types";

const INITIAL: ActionResult = { error: null };

/**
 * `canManage` es false cuando la empresa no tiene ningún cliente de Stripe
 * guardado — aunque su estado sea 'active' (pasa con datos sembrados a mano o
 * si el webhook nunca llegó). En ese caso se ofrece suscribirse, porque no hay
 * ningún portal de Stripe que abrir.
 */
export function BillingActions({
  canManage,
  status,
}: {
  canManage: boolean;
  status: string;
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

  return (
    <div className="mt-6 flex flex-col gap-3">
      <form action={formAction}>
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
