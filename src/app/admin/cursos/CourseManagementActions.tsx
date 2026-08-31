"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  CurriculumIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { CourseStatus } from "@/types";
import { updateCourseStatusAction } from "./[id]/actions";
import { deleteCourseAction } from "./actions";

const iconActionClassName =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function CourseStatusToggle({
  courseId,
  initialStatus,
}: {
  courseId: string;
  initialStatus: CourseStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const nextStatus: CourseStatus =
      status === "published" ? "draft" : "published";
    setError(null);
    startTransition(async () => {
      const result = await updateCourseStatusAction(courseId, nextStatus);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStatus(nextStatus);
    });
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={status === "published"}
        aria-label={status === "published" ? "Hacer privado" : "Hacer público"}
        title={status === "published" ? "Hacer privado" : "Hacer público"}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
          status === "published"
            ? "bg-accent text-accent-foreground hover:opacity-90"
            : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {pending ? <LoadingSpinner className="h-3 w-3" /> : null}
        {pending ? "Guardando…" : status === "published" ? "Público" : "Privado"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 max-w-xs text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CourseManagementActions({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function deleteCourse() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCourseAction(courseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDialogOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div
        role="group"
        className="flex items-center gap-2"
        aria-label={`Acciones de ${courseTitle}`}
      >
        <Link
          href={`/admin/cursos/${courseId}/ajustes`}
          aria-label="Ajustes del curso"
          title="Ajustes"
          className={iconActionClassName}
        >
          <SettingsIcon className="h-5 w-5" />
        </Link>
        <Link
          href={`/admin/cursos/${courseId}`}
          aria-label="Editar currículum"
          title="Currículum"
          className={iconActionClassName}
        >
          <CurriculumIcon className="h-5 w-5" />
        </Link>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDialogOpen(true);
          }}
          disabled={pending}
          aria-label="Eliminar curso"
          title="Eliminar"
          className={`${iconActionClassName} border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800`}
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title="Eliminar curso"
        description={`Se eliminarán “${courseTitle}”, sus lecciones y los accesos concedidos. Si el curso tiene alguna venta, Delunivo lo conservará para proteger el historial de compras.`}
        confirmLabel="Eliminar curso"
        destructive
        pending={pending}
        onClose={() => {
          if (!pending) setDialogOpen(false);
        }}
        onConfirm={deleteCourse}
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
