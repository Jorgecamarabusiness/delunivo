"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

type DeletionStatus = {
  state: "processing" | "retry" | "completed";
  stage: string;
};

function isDeletionStatus(value: unknown): value is DeletionStatus {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.state === "processing" || candidate.state === "retry" || candidate.state === "completed") &&
    typeof candidate.stage === "string"
  );
}

export function AccountDeletionProgress({ initialStatus }: { initialStatus: DeletionStatus | null }) {
  const [status, setStatus] = useState(initialStatus);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status?.state === "completed") return;

    let active = true;
    async function refresh() {
      try {
        const response = await fetch("/api/account-deletion/status", { cache: "no-store" });
        const body: unknown = await response.json();
        const next = isDeletionStatus(body)
          ? body
          : isDeletionStatus((body as { status?: unknown } | null)?.status)
            ? (body as { status: DeletionStatus }).status
            : null;
        if (!response.ok || !next) throw new Error("No se pudo consultar el estado.");
        if (active) {
          setStatus(next);
          setNetworkError(null);
        }
      } catch {
        if (active) setNetworkError("No se pudo actualizar el estado. Puedes dejar esta página abierta e intentarlo de nuevo.");
      }
    }

    const interval = window.setInterval(refresh, 5_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [status?.state]);

  async function retry() {
    setRetrying(true);
    setNetworkError(null);
    try {
      const response = await fetch("/api/account-deletion/retry", { method: "POST" });
      const body: unknown = await response.json();
      const next = isDeletionStatus(body)
        ? body
        : isDeletionStatus((body as { status?: unknown } | null)?.status)
          ? (body as { status: DeletionStatus }).status
          : null;
      if (!response.ok || !next) throw new Error();
      setStatus(next);
    } catch {
      setNetworkError("No se pudo reintentar todavía. Vuelve a intentarlo en unos minutos.");
    } finally {
      setRetrying(false);
    }
  }

  if (!status) {
    return <Alert variant="info">No hay una eliminación de cuenta en curso.</Alert>;
  }

  if (status.state === "completed") {
    return <Alert variant="success">La eliminación de la cuenta se ha completado.</Alert>;
  }

  return (
    <div className="flex flex-col gap-5" aria-live="polite" aria-busy={status.state === "processing" || retrying}>
      <Alert variant={status.state === "retry" ? "warning" : "info"}>
        <p className="font-medium">
          {status.state === "retry" ? "La eliminación necesita atención" : "Eliminación en proceso"}
        </p>
        <p className="mt-1">{status.stage}</p>
      </Alert>
      {networkError ? <Alert variant="error">{networkError}</Alert> : null}
      {status.state === "retry" ? (
        <div>
          <Button type="button" variant="primary" onClick={retry} disabled={retrying}>
            {retrying ? "Reintentando…" : "Reintentar eliminación"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Esta página se actualiza cada cinco segundos.</p>
      )}
    </div>
  );
}
