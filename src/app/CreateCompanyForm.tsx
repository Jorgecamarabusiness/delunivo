"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { createCompanyAction, type CreateCompanyState } from "./actions";
import { formatPlatformPrice } from "@/lib/billing/access";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";
import Link from "next/link";

const INITIAL: CreateCompanyState = { error: null };

export function CreateCompanyForm({
  priceCents,
  referralStatus = null,
}: {
  priceCents: number;
  referralStatus?: "valid" | "invalid" | null;
}) {
  const [state, formAction, pending] = useActionState(
    createCompanyAction,
    INITIAL
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      {referralStatus === "valid" ? (
        <Alert variant="success">
          Enlace de invitación aplicado: tendrás un 10% de descuento durante tus
          tres primeras mensualidades pagadas.
        </Alert>
      ) : null}
      {referralStatus === "invalid" ? (
        <Alert variant="error">
          Este enlace de invitación no es válido o ya está desactivado.
        </Alert>
      ) : null}
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
          minLength={MIN_PASSWORD_LENGTH}
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
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </Field>

      <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
        <input
          type="checkbox"
          name="acceptTerms"
          value="yes"
          required
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>
          He leído y acepto las{" "}
          <Link href="/condiciones" className="font-medium text-foreground underline">
            condiciones de contratación
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="font-medium text-foreground underline">
            política de privacidad
          </Link>
          .
        </span>
      </label>

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
