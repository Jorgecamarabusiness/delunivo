"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createCourseAction, type CourseActionState } from "./actions";

const initialState: CourseActionState = { error: null };

export function CourseCreateForm() {
  const [state, formAction, pending] = useActionState(
    createCourseAction,
    initialState
  );

  return (
    <>
      <form
        action={formAction}
        className="mt-8 rounded-lg border border-border p-4"
      >
        <fieldset
          disabled={pending}
          className="flex min-w-0 flex-col items-stretch gap-3 border-0 p-0 sm:flex-row sm:flex-wrap sm:items-end"
          aria-busy={pending}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[260px]">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="title">
              Título del nuevo curso
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={160}
              autoComplete="off"
              placeholder="Ej. Marketing Digital para Emprendedores"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="price">
              Precio
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              inputMode="decimal"
              placeholder="49.00"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent sm:w-28"
            />
          </div>
          <SubmitButton pendingLabel="Creando curso…" className="w-full sm:w-auto">
            Crear curso
          </SubmitButton>
        </fieldset>

        {state.error ? (
          <Alert variant="error" className="mt-4">
            {state.error}
          </Alert>
        ) : null}
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Se crea como privado. Podrás hacerlo público cuando esté listo.
      </p>
    </>
  );
}
