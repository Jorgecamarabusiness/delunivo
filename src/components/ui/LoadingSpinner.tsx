type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export function LoadingSpinner({
  className = "h-4 w-4",
  label,
}: LoadingSpinnerProps) {
  return (
    <span
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`.trim()}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
