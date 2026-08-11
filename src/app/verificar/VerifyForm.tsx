"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { verifyCodeAction, resendCodeAction, type VerifyState } from "./actions";

const INITIAL: VerifyState = { error: null };

export function VerifyForm({ email, next }: { email: string; next: string }) {
  const [state, formAction, pending] = useActionState(verifyCodeAction, INITIAL);
  const [resendState, resendAction, resending] = useActionState(
    resendCodeAction,
    INITIAL
  );

  return (
    <>
      <form action={formAction} className="mt-8 flex flex-col gap-5">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />

        <Field label="Código de verificación" htmlFor="code">
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
            className="text-center text-2xl font-semibold tracking-[0.5em]"
          />
        </Field>

        {state.error && <Alert variant="error">{state.error}</Alert>}

        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Comprobando…" : "Confirmar"}
        </Button>
      </form>

      <form action={resendAction} className="mt-6 flex flex-col items-center gap-3">
        <input type="hidden" name="email" value={email} />

        {resendState.resent && !resendState.error && (
          <Alert variant="success" className="w-full">
            Te hemos enviado un código nuevo.
          </Alert>
        )}
        {resendState.error && (
          <Alert variant="error" className="w-full">
            {resendState.error}
          </Alert>
        )}

        <button
          type="submit"
          disabled={resending}
          className="text-sm text-muted-foreground underline disabled:opacity-50"
        >
          {resending ? "Enviando…" : "No me ha llegado, enviar otro código"}
        </button>
      </form>
    </>
  );
}
