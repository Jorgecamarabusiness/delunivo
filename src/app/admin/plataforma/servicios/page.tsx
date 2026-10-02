import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { readIntegrationReadiness } from "@/lib/integrations/readiness";
import { prepareCatalogueAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ catalogue?: string }> }) {
  const result = await readIntegrationReadiness();
  if (!result.ok) redirect("/admin");
  const report = result.report;
  const { catalogue } = await searchParams;
  const catalogueVerified = report.prices.state === "verified" && report.prices.data.catalogueVerified;
  const canPrepare = report.stripeMode === "live" && report.account.state === "verified" && report.account.data.chargesEnabled;
  const controls = [
    ["Nuevos planes", report.controls.plans],
    ["Procesamiento de consumo", report.controls.worker],
    ["Importación de Mux", report.controls.usageImport],
    ["Avisos de capacidad", report.controls.capacityNotices],
    ["Ejecución de conservación", report.controls.retentionExecution],
    ["Fiscalidad LIVE aprobada", report.controls.taxLiveApproved],
  ] as const;

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Link href="/admin/plataforma" className={buttonClassName("outline", "sm", "min-h-11")}>
          Volver al control de plataforma
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Estado de servicios</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Comprobación de Stripe, Mux y los controles de lanzamiento. Recarga la página para actualizarla.
        </p>
        <p className="text-sm text-muted-foreground">
          Comprobado: <time dateTime={report.inspectedAt}>{new Intl.DateTimeFormat("es-ES", {
            dateStyle: "medium", timeStyle: "medium", timeZone: "Europe/Madrid",
          }).format(new Date(report.inspectedAt))} (Madrid)</time>
        </p>
      </header>

      {catalogue === "failed" && <Alert variant="warning">La preparación del catálogo sigue pendiente. Revisa los detalles de la comprobación antes de volver a intentarlo.</Alert>}

      <Card className="min-w-0 space-y-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Catálogo aprobado</h2>
        <p className="text-sm text-muted-foreground">Inicio 30 €, Crece 69 €, Academia 149 € y biblioteca adicional 8 € al mes; bolsa de entrega 20 € una vez. Impuestos incluidos. Oferta 2026-10-01.</p>
        <p className="text-sm text-muted-foreground">Prepara los cinco precios en Stripe LIVE. La activación de ventas se controla por separado en el lanzamiento.</p>
        {catalogueVerified ? <p className="text-sm font-medium">Cinco precios versionados disponibles. Revisa importes y fiscalidad en los detalles.</p> : <form action={prepareCatalogueAction}>
          <SubmitButton disabled={!canPrepare} pendingLabel="Preparando catálogo LIVE…">Preparar catálogo LIVE</SubmitButton>
          {!canPrepare && <p className="mt-3 text-sm text-muted-foreground">La preparación requiere verificar la cuenta Stripe LIVE y sus cobros habilitados.</p>}
        </form>}
      </Card>

      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <Card className="min-w-0 space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Stripe</h2>
          {report.account.state === "verified" ? (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Cuenta</dt><dd className="break-all font-medium">{report.account.data.id}</dd></div>
              <div><dt className="text-muted-foreground">Modo</dt><dd>{report.stripeMode === "live" ? "LIVE" : "Prueba u otro"}</dd></div>
              <div><dt className="text-muted-foreground">País</dt><dd>{report.account.data.country ?? "Desconocido"}</dd></div>
              <div><dt className="text-muted-foreground">Cobros</dt><dd>{report.account.data.chargesEnabled ? "Habilitados" : "No habilitados"}</dd></div>
              <div><dt className="text-muted-foreground">Tarifas fiscales activas</dt><dd>{report.rates.state === "verified" ? `${report.rates.data.rates.length}${report.rates.data.truncated ? " o más" : ""}` : "Desconocido"}</dd></div>
              <div><dt className="text-muted-foreground">Precios del catálogo actual</dt><dd>{report.prices.state === "verified" ? `${report.prices.data.prices.length}${report.prices.data.truncated ? " (lectura parcial)" : ""}` : "Desconocido"}</dd></div>
            </dl>
          ) : <Alert variant="warning">Estado de Stripe desconocido. No se ha podido completar la lectura del proveedor.</Alert>}
        </Card>
        <Card className="min-w-0 space-y-4 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">Mux</h2>
          {report.mux.state === "verified" ? (
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted-foreground">Organización</dt><dd className="break-words font-medium">{report.mux.data.organizationName}</dd></div>
              <div><dt className="text-muted-foreground">Entorno</dt><dd className="break-words">{report.mux.data.environmentName} ({report.mux.data.environmentType})</dd></div>
              <div><dt className="text-muted-foreground">Identificador del entorno</dt><dd className="break-all">{report.mux.data.environmentId}</dd></div>
              <div><dt className="text-muted-foreground">Configuración de consumo</dt><dd>{report.mux.data.configuredEnvironmentMatches ? "Coincide con el entorno" : "Pendiente de configurar o no coincide"}</dd></div>
            </dl>
          ) : <Alert variant="warning">Estado de Mux desconocido. No se ha podido completar la lectura del proveedor.</Alert>}
        </Card>
      </div>

      <Card className="min-w-0 space-y-4 p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Controles de lanzamiento</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {controls.map(([name, enabled]) => <div key={name}><dt className="text-muted-foreground">{name}</dt><dd className="font-medium">{enabled ? "Activado" : "Desactivado"}</dd></div>)}
          <div><dt className="text-muted-foreground">Borrado de Mux</dt><dd className="font-medium">{report.controls.muxDeletionDisabled ? "Desactivado" : "Revisar configuración"}</dd></div>
        </dl>
      </Card>
      <details className="min-w-0 rounded-lg border border-border p-5 sm:p-6">
        <summary className="cursor-pointer rounded-md font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Detalles de la comprobación</summary>
        <pre className="mt-4 whitespace-pre-wrap break-all text-xs text-muted-foreground">{JSON.stringify(report, null, 2)}</pre>
      </details>
    </div>
  );
}
