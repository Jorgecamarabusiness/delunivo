"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { resetPasswordAction, type ResetPasswordState } from "./actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";

const INITIAL: ResetPasswordState = { error: null };

/**
 * Ya no depende de ninguna sesión de recuperación en el fragmento (#) de la
 * URL: el usuario llega aquí con su correo y escribe el código de 6 dígitos que
 * le ha enviado Delunivo por Resend.
 */
export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    INITIAL
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <Field label="Correo electrónico" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={email}
          required
          readOnly={Boolean(email)}
          className={email ? "bg-muted" : ""}
        />
      </Field>

      <Field label="Código de verificación" htmlFor="code">
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          required
          autoFocus
          className="text-center text-2xl font-semibold tracking-[0.5em]"
        />
      </Field>

      <Field label="Contraseña nueva" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Confirmar contraseña nueva" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>

      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar nueva contraseña"}
      </Button>
    </form>
  );
}
