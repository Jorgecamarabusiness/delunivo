"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { grantFreeCourseAccessAction } from "./actions";

/**
 * Esta página solo se alcanza desde una intención explícita de acceder gratis.
 * El GET no concede nada: al montar, esta pieza cliente emite una Server Action
 * POST con las comprobaciones de origen de Next y las reglas atómicas del RPC.
 */
export function FreeCourseAccessOnReturn({
  courseId,
  aprenderHref,
}: {
  courseId: string;
  aprenderHref: string;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function continueAccess() {
    setError(null);
    startTransition(async () => {
      const result = await grantFreeCourseAccessAction(courseId);
      if (result.granted) {
        router.replace(aprenderHref);
        return;
      }
      setError(result.error ?? "No se pudo activar el acceso gratuito.");
    });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    continueAccess();
    // Solo se activa una vez tras la intención preservada en `next`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Activando tu acceso</h1>
      <p className="text-sm text-muted-foreground">
        Estamos preparando tu curso gratuito.
      </p>
      {error ? (
        <>
          <Alert variant="error" className="text-left">
            {error}
          </Alert>
          <Button type="button" variant="primary" onClick={continueAccess} disabled={pending}>
            Reintentar
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pending ? "Comprobando tu acceso..." : "Un momento..."}
        </p>
      )}
    </div>
  );
}
