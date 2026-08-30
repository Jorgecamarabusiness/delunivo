"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PLATFORM_NAME } from "@/lib/brand";

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"
      />
      <circle cx="9" cy="7" r="3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 11a3 3 0 1 0 0-6" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 19v-1a4 4 0 0 0-3-3.87"
      />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"
      />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    </svg>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9 9 0 1 1 9-9c0 1.5-1 2.5-2.5 2.5h-2a2 2 0 0 0-1.5 3.3c.4.5.2 1.3-.5 1.9-.7.6-1.6 1.3-2.5 1.3Z"
      />
      <circle cx="7.5" cy="10.5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 15h4" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

function PlatformIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
    </svg>
  );
}

type AdminSidebarProps = {
  adminName: string;
  organizationHref?: string;
  /** Solo el dueño de la plataforma ve la lista de correos de prueba. */
  isSuperAdmin?: boolean;
};

export function AdminSidebar({
  adminName,
  organizationHref,
  isSuperAdmin,
}: AdminSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Inicio", Icon: HomeIcon },
    { href: "/admin/cursos", label: "Cursos", Icon: BookIcon },
    { href: "/admin/usuarios", label: "Usuarios", Icon: UsersIcon },
    { href: "/admin/estadisticas", label: "Estadísticas", Icon: ChartIcon },
    { href: "/admin/marca", label: "Marca", Icon: PaletteIcon },
    { href: "/admin/configuracion", label: "Cobros", Icon: CreditCardIcon },
    { href: "/admin/facturacion", label: "Facturación", Icon: ReceiptIcon },
    ...(isSuperAdmin
      ? [{ href: "/admin/plataforma", label: "Control Delunivo", Icon: PlatformIcon }]
      : []),
  ];

  return (
    <aside
      className={`admin-sidebar sticky top-0 flex h-dvh shrink-0 self-start flex-col border-r border-border bg-background transition-[width] duration-200 ${
        expanded ? "admin-sidebar-expanded" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-5">
        <div
          aria-label={PLATFORM_NAME}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground md:hidden"
        >
          D
        </div>
        {expanded ? (
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-base font-bold tracking-tight">{PLATFORM_NAME}</p>
            <p className="truncate text-xs text-muted-foreground">Bienvenido {adminName}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-auto hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted md:flex"
          aria-label={expanded ? "Contraer menú" : "Expandir menú"}
        >
          <ChevronIcon
            className={`h-4 w-4 transition-transform ${expanded ? "" : "rotate-180"}`}
          />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-foreground text-background" : "hover:bg-muted"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded ? <span className="hidden truncate md:inline">{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-2 py-4">
        <Link
          href={organizationHref ?? "/"}
          aria-label={organizationHref ? "Ver mi página" : "Volver a Delunivo"}
          title={organizationHref ? "Ver mi página" : "Volver a Delunivo"}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HomeIcon className="h-5 w-5 shrink-0" />
          {expanded ? (
            <span className="hidden truncate md:inline">
              {organizationHref ? "Ver mi página" : "Volver a Delunivo"}
            </span>
          ) : null}
        </Link>
      </div>
    </aside>
  );
}
