"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/Button";

/**
 * Red de seguridad para todo /admin. Antes de esto, cualquier `throw` de una
 * server action (p. ej. "Todavía no tienes ninguna suscripción activa") llegaba
 * al usuario como la pantalla genérica de Next con un digest y ningún mensaje.
 *
 * Las actions deberían devolver `ActionResult` y pintar el error en su propio
 * formulario; esto solo cubre lo que se escape de ahí.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Algo ha fallado</h1>

      <p className="text-sm text-muted-foreground">
        {error.message || "No hemos podido completar la operación."}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className={buttonClassName("primary", "md")}
        >
          Volver a intentarlo
        </button>
        <Link href="/admin" className={buttonClassName("outline", "md")}>
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
