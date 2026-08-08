"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeAdminAction } from "./actions";

export function AdminActions({ adminUserId }: { adminUserId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    const confirmed = window.confirm(
      "¿Quitar a este administrador de tu empresa? Dejará de poder gestionar tus cursos."
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    const result = await removeAdminAction(adminUserId);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={pending}
        className="text-xs font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      >
        Quitar
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
