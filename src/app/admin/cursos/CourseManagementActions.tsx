"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CourseStatus } from "@/types";
import { updateCourseStatusAction } from "./[id]/actions";
import { deleteCourseAction } from "./actions";

export function CourseManagementActions({
  courseId,
  courseTitle,
  initialStatus,
}: {
  courseId: string;
  courseTitle: string;
  initialStatus: CourseStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [deleted, setDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisibilityPending, startVisibilityTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  if (deleted) return null;

  function toggleVisibility() {
    setError(null);
    const nextStatus: CourseStatus =
      status === "published" ? "draft" : "published";

    startVisibilityTransition(async () => {
      const result = await updateCourseStatusAction(courseId, nextStatus);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(nextStatus);
    });
  }

  function deleteCourse() {
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteCourseAction(courseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      setDeleted(true);
    });
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleVisibility}
          disabled={isVisibilityPending || isDeletePending}
          aria-busy={isVisibilityPending}
        >
          {isVisibilityPending ? <LoadingSpinner /> : null}
          {isVisibilityPending
            ? "Guardando…"
            : status === "published"
              ? "Hacer privado"
              : "Hacer público"}
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
          disabled={isVisibilityPending || isDeletePending}
        >
          Eliminar
        </Button>
      </div>

      {error && !dialogOpen ? (
        <Alert variant="error" className="w-full sm:max-w-md">
          {error}
        </Alert>
      ) : null}

      <ConfirmDialog
        open={dialogOpen}
        title="Eliminar curso"
        description={`Se eliminarán “${courseTitle}”, sus lecciones y los accesos concedidos. Si el curso tiene alguna venta, Delunivo lo conservará para proteger el historial de compras.`}
        confirmLabel="Eliminar curso"
        destructive
        pending={isDeletePending}
        onClose={() => {
          if (!isDeletePending) setDialogOpen(false);
        }}
        onConfirm={deleteCourse}
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
      </ConfirmDialog>
    </div>
  );
}
