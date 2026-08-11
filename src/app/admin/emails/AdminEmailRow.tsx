"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { toggleAdminEmailAction, deleteAdminEmailAction } from "./actions";
import type { AdminEmail } from "@/lib/email/adminEmails";

export function AdminEmailRow({ entry }: { entry: AdminEmail }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ error: string | null }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
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
          className="text-sm underline disabled:opacity-50"
        >
          {entry.isActive ? "Desactivar" : "Activar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`¿Quitar ${entry.email} de la lista?`)) return;
            run(() => deleteAdminEmailAction(entry.id));
          }}
          className="ml-4 text-sm text-red-600 underline disabled:opacity-50"
        >
          Quitar
        </button>
      </td>
    </tr>
  );
}
