"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { revokeInvitationAction } from "./actions";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleRevoke() {
    setPending(true);
    setError(null);
    const result = await revokeInvitationAction(invitationId);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setDialogOpen(true);
        }}
        disabled={pending}
        className="inline-flex min-h-11 items-center px-3 text-xs font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      >
        Revocar
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <ConfirmDialog
        open={dialogOpen}
        title="Revocar invitación"
        description="El enlace dejará de funcionar y tendrás que crear una invitación nueva si cambias de opinión."
        confirmLabel="Revocar"
        destructive
        pending={pending}
        onClose={() => {
          if (!pending) setDialogOpen(false);
        }}
        onConfirm={handleRevoke}
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
      </ConfirmDialog>
    </div>
  );
}
