"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { addAdminEmailAction } from "./actions";
import type { ActionResult } from "@/types";

const INITIAL: ActionResult = { error: null };

export function AddAdminEmailForm() {
  const [state, formAction, pending] = useActionState(
    addAdminEmailAction,
    INITIAL
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Input
          name="email"
          type="email"
          placeholder="correo@ejemplo.com"
          required
          className="min-w-[220px] flex-1"
        />
        <Input
          name="label"
          type="text"
          placeholder="Para qué es (opcional)"
          className="min-w-[180px] flex-1"
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Añadiendo…" : "Añadir"}
        </Button>
      </div>

      {state.error && <Alert variant="error">{state.error}</Alert>}
    </form>
  );
}
