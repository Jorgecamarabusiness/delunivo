"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toggleAdminEmailAction, deleteAdminEmailAction } from "./actions";
import type { AdminEmail } from "@/lib/email/adminEmails";

export function AdminEmailRow({ entry }: { entry: AdminEmail }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const run = (
    action: () => Promise<{ error: string | null }>,
    onSuccess?: () => void
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        onSuccess?.();
      }
    });
  };

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <span className="font-medium">{entry.email}</span>
        {entry.label && (
          <p className="text-xs text-muted-foreground">{entry.label}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>

      <td className="py-3 pr-4">
        <Badge variant={entry.isActive ? "solid" : "outline"}>
          {entry.isActive ? "Activo" : "Inactivo"}
        </Badge>
      </td>

      <td className="py-3 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => toggleAdminEmailAction(entry.id, !entry.isActive))}
          className="inline-flex min-h-11 items-center px-2 text-sm underline disabled:opacity-50"
        >
          {entry.isActive ? "Desactivar" : "Activar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
          className="ml-2 inline-flex min-h-11 items-center px-2 text-sm text-red-600 underline disabled:opacity-50"
        >
          Quitar
        </button>
      </td>
      <ConfirmDialog
        open={dialogOpen}
        title="Quitar correo de prueba"
        description={`Se eliminará ${entry.email} de la lista de destinatarios de desarrollo.`}
        confirmLabel="Quitar correo"
        destructive
        pending={pending}
        onClose={() => {
          if (!pending) setDialogOpen(false);
        }}
        onConfirm={() =>
          run(() => deleteAdminEmailAction(entry.id), () => setDialogOpen(false))
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
      </ConfirmDialog>
    </tr>
  );
}
