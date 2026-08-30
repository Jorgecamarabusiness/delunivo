"use client";

import Link from "next/link";

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6 0v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6M8.5 9.5v5m3-5v5"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z"
      />
    </svg>
  );
}

export function RowMenu({
  editHref,
  onEdit,
  editLabel = "Editar",
  onDelete,
  deleteLabel = "Eliminar",
  isDeleting,
}: {
  editHref?: string;
  onEdit?: () => void;
  editLabel?: string;
  onDelete: () => void;
  deleteLabel?: string;
  isDeleting: boolean;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1">
      {editHref ? (
        <Link
          href={editHref}
          aria-label={editLabel}
          title={editLabel}
          className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-auto md:px-3"
        >
          <PencilIcon />
          <span className="hidden md:inline">{editLabel}</span>
        </Link>
      ) : onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          title={editLabel}
          className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-auto md:px-3"
        >
          <PencilIcon />
          <span className="hidden md:inline">{editLabel}</span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={deleteLabel}
        title={deleteLabel}
        className="inline-flex h-10 w-10 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 md:w-auto md:px-3"
      >
        <TrashIcon />
        <span className="hidden md:inline">
          {isDeleting ? "Eliminando…" : deleteLabel}
        </span>
      </button>
    </div>
  );
}
