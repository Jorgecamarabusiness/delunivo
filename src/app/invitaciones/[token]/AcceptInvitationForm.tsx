"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  acceptInvitationWithNewAccountAction,
  acceptInvitationWithExistingSessionAction,
} from "./actions";

export function AcceptInvitationForm({
  token,
  mode,
}: {
  token: string;
  mode: "create-account" | "confirm";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "confirm") {
    return (
      <div className="mt-8">
        {error && (
          <p className="mb-4 text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const result = await acceptInvitationWithExistingSessionAction(token);
            setPending(false);
            if (result?.error) setError(result.error);
          }}
        >
          {pending ? "Aceptando..." : "Aceptar invitación"}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-8 flex flex-col gap-5"
      action={async (formData: FormData) => {
        setError(null);
        setPending(true);
        const password = String(formData.get("password") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");
        const result = await acceptInvitationWithNewAccountAction(
          token,
          password,
          confirmPassword
        );
        setPending(false);
        if (result?.error) setError(result.error);
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Elige una contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirma la contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="rounded-md border border-border px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={pending} className="mt-2">
        {pending ? "Creando cuenta..." : "Crear cuenta y aceptar"}
      </Button>
    </form>
  );
}
