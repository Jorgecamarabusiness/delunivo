"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { registerAction, type RegisterState } from "./actions";

const INITIAL: RegisterState = { error: null };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, INITIAL);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <Field label="Nombre completo" htmlFor="name">
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Tu nombre"
          required
          autoComplete="name"
        />
      </Field>

      <Field label="Correo electrónico" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Confirmar contraseña" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </Field>

      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
