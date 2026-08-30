"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClassName } from "@/components/ui/Button";
import { PLATFORM_NAME } from "@/lib/brand";

type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | null;

export function AdminBillingGate({
  status,
  children,
}: {
  status: BillingStatus;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isFacturacion = pathname === "/admin/facturacion";

  if (status === "canceled" && !isFacturacion) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Cuenta suspendida</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Tu suscripción a {PLATFORM_NAME} se ha cancelado. Reactívala para volver a
          acceder a tu panel de administración — tus alumnos que ya compraron
          un curso mantienen su acceso mientras tanto.
        </p>
        <Link href="/admin/facturacion" className={buttonClassName("primary", "md")}>
          Ir a facturación
        </Link>
      </div>
    );
  }

  return (
    <>
      {status === "past_due" && !isFacturacion && (
        <div className="border-b border-border bg-muted px-6 py-3 text-center text-sm font-medium">
          Hay un problema con tu último pago a {PLATFORM_NAME}.{" "}
          <Link href="/admin/facturacion" className="underline">
            Revísalo aquí
          </Link>
          .
        </div>
      )}
      {children}
    </>
  );
}
