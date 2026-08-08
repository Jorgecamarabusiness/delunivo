"use client";

import { useEffect, useState, useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState
  );

  // El enlace del correo llega con la sesión de recuperación en el
  // fragmento (#) de la URL — solo el cliente puede leerlo. Al crear el
  // cliente de navegador, supabase-js lo detecta y establece la sesión
  // automáticamente; getSession() espera a que termine esa comprobación.
  const [sessionStatus, setSessionStatus] = useState<
    "checking" | "ready" | "invalid"
  >("checking");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessionStatus(data.session ? "ready" : "invalid");
    });
  }, []);

  if (sessionStatus === "checking") {
    return (
      <p className="mt-10 text-center text-sm text-muted-foreground">
        Comprobando el enlace...
      </p>
    );
  }

  if (sessionStatus === "invalid") {
    return (
      <div className="mt-10 rounded-md border border-border p-6 text-center">
        <p className="text-sm font-semibold text-red-600">
          Este enlace ha caducado o no es válido
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Pide uno nuevo desde &quot;¿Has olvidado tu contraseña?&quot;.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña nueva
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
          Confirmar contraseña nueva
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
        {pending ? "Guardando..." : "Guardar nueva contraseña"}
      </Button>
    </form>
  );
}
