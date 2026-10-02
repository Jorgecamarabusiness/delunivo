"use client";
import { useActionState } from "react";
import {
  recoverCapacityAction,
  type CapacityActionState,
} from "./capacityActions";
import { buttonClassName } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
export function CapacityRecovery({
  organizationId,
  operationId,
  checkout,
}: {
  organizationId: string;
  operationId: string;
  checkout: boolean;
}) {
  const [state, action, pending] = useActionState(recoverCapacityAction, {
    error: null,
  } as CapacityActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="operationId" value={operationId} />
      <div className="flex flex-wrap gap-2">
        <button
          disabled={pending}
          name="recoveryAction"
          value="reconcile"
          className={buttonClassName("outline", "sm", "min-h-11")}
        >
          {pending ? "Comprobando…" : "Actualizar pago"}
        </button>
        <button
          disabled={pending}
          name="recoveryAction"
          value="continue"
          className={buttonClassName("outline", "sm", "min-h-11")}
        >
          Continuar pago
        </button>
        {checkout ? (
          <button
            disabled={pending}
            name="recoveryAction"
            value="expire"
            className={buttonClassName("outline", "sm", "min-h-11")}
          >
            Cerrar checkout pendiente
          </button>
        ) : null}
      </div>
      {state.error ? <Alert variant="error">{state.error}</Alert> : null}
      {state.message ? <Alert variant="success">{state.message}</Alert> : null}
    </form>
  );
}
