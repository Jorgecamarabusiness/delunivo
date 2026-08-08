"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  async function handleRemove() {
    const confirmed = window.confirm(
      "¿Seguro que quieres echar a este alumno? Perderá el acceso a los cursos de tu organización."
    );
    if (!confirmed) return;

    const reason = window.prompt("Motivo (opcional):") ?? null;

    setPending(true);
    setError(null);
    const result = await removeStudentAction(studentUserId, reason);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReactivate() {
    const confirmed = window.confirm("¿Devolver el acceso a este alumno?");
    if (!confirmed) return;

    setPending(true);
    setError(null);
    const result = await reactivateStudentAction(studentUserId);
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
        onClick={status === "active" ? handleRemove : handleReactivate}
        disabled={pending}
        className="text-xs font-medium text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      >
        {status === "active" ? "Echar" : "Reactivar"}
      </button>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
