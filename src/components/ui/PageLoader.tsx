import { LoadingSpinner } from "./LoadingSpinner";

export function PageLoader({ label = "Cargando página…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[45vh] w-full flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner className="h-7 w-7" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
