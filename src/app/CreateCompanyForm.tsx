"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { createCompanyAction, type CreateCompanyState } from "./actions";
import { formatPlatformPrice } from "@/lib/billing/access";

const INITIAL: CreateCompanyState = { error: null };

export function CreateCompanyForm({ priceCents }: { priceCents: number }) {
  const [state, formAction, pending] = useActionState(
    createCompanyAction,
    INITIAL
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      <Field
        label="Nombre de tu empresa"
        htmlFor="companyName"
        hint="Será la dirección pública de tu escuela."
      >
        <Input
          id="companyName"
          name="companyName"
          type="text"
          placeholder="Ej. Cursos de Ana"
          required
        />
      </Field>

      <Field label="Tu nombre" htmlFor="name">
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
        {pending ? "Creando tu cuenta…" : "Crear mi escuela"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {formatPlatformPrice(priceCents)}/mes. Cancela cuando quieras.
      </p>
    </form>
  );
}
