"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { startRunAsAction } from "./runAsActions";

export function RunAsButton({
  targetUserId,
  targetName,
}: {
  targetUserId: string;
  targetName: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    const data = new FormData();
    data.set("targetUserId", targetUserId);
    data.set("reason", reason);
    setError(null);
    startTransition(async () => {
      const result = await startRunAsAction(data);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Run as
      </Button>
      <ConfirmDialog
        open={open}
        title={`Entrar como ${targetName}`}
        description="Abrirás una sesión auditada de 15 minutos. La facturación, credenciales y otras acciones sensibles quedarán bloqueadas."
        confirmLabel="Iniciar Run as"
        pending={pending}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        onConfirm={start}
      >
        <label className="block text-sm font-medium">
          Motivo del soporte
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={500}
            rows={3}
            className="mt-2"
            placeholder="Ej. Revisar el error al abrir el editor del curso"
          />
        </label>
        {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
