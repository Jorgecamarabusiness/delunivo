"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const INITIAL: ForgotPasswordState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    INITIAL
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <Field label="Correo electrónico" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          autoFocus
          autoComplete="email"
        />
      </Field>

      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Enviando…" : "Enviarme un código"}
      </Button>
    </form>
  );
}
