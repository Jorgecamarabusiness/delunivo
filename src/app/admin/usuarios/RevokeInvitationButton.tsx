"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revokeInvitationAction } from "./actions";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    const confirmed = window.confirm("¿Revocar esta invitación pendiente?");
    if (!confirmed) return;

    setPending(true);
    setError(null);
    const result = await revokeInvitationAction(invitationId);
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
        onClick={handleRevoke}
        disabled={pending}
        className="text-xs font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      >
        Revocar
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
