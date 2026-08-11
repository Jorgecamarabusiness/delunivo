"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { connectStripeAction } from "./actions";
import type { ActionResult } from "@/types";

export function StripeConnectButton({ isConnected }: { isConnected: boolean }) {
  const [state, formAction, pending] = useActionState(connectStripeAction, {
    error: null,
  } satisfies ActionResult);

  return (
    <div className="mt-4 flex flex-col gap-3">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className={buttonClassName("primary", "md")}
        >
          {pending
            ? "Abriendo Stripe…"
            : isConnected
              ? "Revisar conexión con Stripe"
              : "Conectar con Stripe"}
        </button>
      </form>

      {state.error && <Alert variant="error">{state.error}</Alert>}
    </div>
  );
}
