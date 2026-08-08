"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { createCompanyAction, type CreateCompanyState } from "./actions";

const initialState: CreateCompanyState = { error: null };

export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(
    createCompanyAction,
    initialState
  );

  if (state.checkEmail) {
    return (
      <div className="mt-10 rounded-md border border-border p-6 text-center">
        <p className="text-sm font-semibold">Revisa tu correo</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Te hemos enviado un enlace para confirmar tu cuenta. Ábrelo, inicia
          sesión y podrás suscribirte desde tu panel.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="companyName" className="text-sm font-medium">
          Nombre de tu empresa
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          placeholder="Ej. Cursos de Ana"
          required
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-medium">
          Tu nombre
        </label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Tu nombre"
          required
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

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

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          minLength={6}
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      {state.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={pending} className="mt-2">
        {pending ? "Creando tu cuenta..." : "Crear mi empresa — 20€/mes"}
      </Button>
    </form>
  );
}
