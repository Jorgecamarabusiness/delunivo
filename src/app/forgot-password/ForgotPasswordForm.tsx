"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initialState
  );

  if (state.sent) {
    return (
      <div className="mt-10 rounded-md border border-border p-6 text-center">
        <p className="text-sm font-semibold">Revisa tu correo</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Si esa dirección tiene una cuenta, te hemos enviado un enlace para
          restablecer tu contraseña.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={pending} className="mt-2">
        {pending ? "Enviando..." : "Enviar enlace de recuperación"}
      </Button>
    </form>
  );
}
