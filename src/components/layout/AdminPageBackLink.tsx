"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminPageBackLink() {
  const pathname = usePathname();
  if (pathname === "/admin") return null;

  const courseMatch = pathname.match(/^\/admin\/cursos\/([^/]+)(?:\/(?:ajustes|lecciones\/[^/]+))?$/);
  const isNestedCoursePage = Boolean(
    courseMatch && pathname !== `/admin/cursos/${courseMatch[1]}`
  );
  const href = isNestedCoursePage
    ? `/admin/cursos/${courseMatch![1]}`
    : pathname.startsWith("/admin/cursos/")
      ? "/admin/cursos"
      : "/admin";
  const label = isNestedCoursePage
    ? "Volver al curso"
    : pathname.startsWith("/admin/cursos/")
      ? "Volver a cursos"
      : "Volver al panel";

  return (
    <div className="border-b border-border px-4 sm:px-6">
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="m12.5 4.5-5 5 5 5M8 9.5h8" />
        </svg>
        {label}
      </Link>
    </div>
  );
}
