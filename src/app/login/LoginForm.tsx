"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { loginAction, type LoginState } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm({
  next,
  basePath,
}: {
  next?: string;
  basePath: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}

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

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <Link
            href={`${basePath}/forgot-password`}
            className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
          >
            ¿Has olvidado tu contraseña?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Iniciando sesión…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
