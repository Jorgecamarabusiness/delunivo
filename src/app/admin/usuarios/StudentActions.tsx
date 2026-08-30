"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { removeStudentAction, reactivateStudentAction } from "./actions";

export function StudentActions({
  studentUserId,
  status,
}: {
  studentUserId: string;
  status: "active" | "removed";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"remove" | "reactivate" | null>(null);
  const [reason, setReason] = useState("");

  async function handleRemove() {
    setPending(true);
    setError(null);
    const result = await removeStudentAction(studentUserId, reason.trim() || null);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDialog(null);
    setReason("");
    router.refresh();
  }

  async function handleReactivate() {
    setPending(true);
    setError(null);
    const result = await reactivateStudentAction(studentUserId);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDialog(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setDialog(status === "active" ? "remove" : "reactivate");
        }}
        disabled={pending}
        className="inline-flex min-h-11 items-center px-3 text-xs font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      >
        {status === "active" ? "Echar" : "Reactivar"}
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <ConfirmDialog
        open={dialog !== null}
        title={dialog === "remove" ? "Echar alumno" : "Reactivar alumno"}
        description={
          dialog === "remove"
            ? "Perderá el acceso a todos los cursos de esta organización, pero se conservarán sus compras y su historial."
            : "Recuperará el acceso a los cursos que haya comprado o recibido por invitación."
        }
        confirmLabel={dialog === "remove" ? "Echar alumno" : "Reactivar"}
        destructive={dialog === "remove"}
        pending={pending}
        onClose={() => {
          if (!pending) setDialog(null);
        }}
        onConfirm={dialog === "remove" ? handleRemove : handleReactivate}
      >
        {dialog === "remove" ? (
          <label className="block text-sm font-medium">
            Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              className="mt-2 resize-y"
              placeholder="Ejemplo: devolución solicitada"
            />
          </label>
        ) : null}
        {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}
      </ConfirmDialog>
    </div>
  );
}
