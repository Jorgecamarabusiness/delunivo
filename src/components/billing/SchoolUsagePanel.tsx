import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { getSchoolUsageSnapshot } from "@/lib/billing/usageSnapshot";
import { formatPlatformPrice } from "@/lib/billing/access";
import { CapacityControls } from "@/app/admin/facturacion/CapacityControls";
import { plansEnabledForSchool } from "@/lib/billing/rollout";
import { fiscalPolicyRequired } from "@/lib/billing/fiscalPolicy";
import { CapacityRecovery } from "@/app/admin/facturacion/CapacityRecovery";
const hours = (value: unknown) =>
  (Number(value) / 3600).toLocaleString("es-ES", { maximumFractionDigits: 2 });
const minutes = (value: unknown) =>
  (Number(value) / 60).toLocaleString("es-ES", { maximumFractionDigits: 1 });
const date = (value: string) =>
  new Date(value).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
export async function SchoolUsagePanel({
  organizationId,
  controls = false,
}: {
  organizationId: string;
  controls?: boolean;
}) {
  const s = await getSchoolUsageSnapshot(organizationId);
  if (s.kind === "error") return <Alert variant="info">{s.message}</Alert>;
  const b = s.billing,
    c = s.cycle;
  const active = Number(s.library.active_seconds),
    reserved = Number(s.library.reserved_seconds),
    committed = Number(s.library.committed_seconds);
  const planName = b.accepted_offer?.name ?? "Oferta anterior";
  const invoice = s.invoices.find((i) => i.currency === "eur");
  const hasBlockingOperation = s.operations.some((op) =>
    ["processing", "pending_payment"].includes(op.status),
  );
  return (
    <section className="space-y-6" aria-label="Consumo y capacidad">
      <div>
        <h2 className="text-xl font-semibold">
          Consumo y capacidad · {planName}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {b.offer_version
            ? `Oferta ${b.offer_version}. ${b.quota_mode === "enforce" ? "Control de capacidad activo." : "Medición en observación."}`
            : "Tu contrato anterior conserva sus condiciones; sin activar cuotas ni conservación de forma retroactiva."}
        </p>
      </div>
      {b.trial_initialization_status === "pending" ? (
        <Alert variant="info">
          La prueba está pendiente de inicialización. Se conservará su fecha
          original; no se cobrará automáticamente.
        </Alert>
      ) : null}
      {b.trial_initialization_status === "used" ? (
        <Alert variant="info">
          Esta identidad ya utilizó la prueba. Puedes contratar un plan; crear
          otra escuela no reinicia la prueba.
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Biblioteca</h3>
          <p>
            {hours(active)} h alojadas · {hours(reserved)} h reservadas{" "}
            {b.offer_version ? `de ${hours(b.library_limit_seconds)} h` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Capacidad pendiente de liberar: {hours(committed)} h.
            {s.library.release_at
              ? ` Próxima liberación prevista: ${date(s.library.release_at)}.`
              : ""}{" "}
            Al sustituir un vídeo se reserva también el nuevo hasta validarlo.
          </p>
          {Number(s.library.unconfirmed_assets) > 0 ? (
            <Alert variant="info">
              Hay duraciones pendientes de confirmar con el proveedor.
            </Alert>
          ) : null}
          {b.library_excess_since ? (
            <Alert variant="info">
              Biblioteca por encima del techo. Nuevas subidas bloqueadas; plazo
              de ajuste hasta{" "}
              {date(
                new Date(
                  Date.parse(b.library_excess_since) + 7 * 86400000,
                ).toISOString(),
              )}
              . Después se pausan nuevas reproducciones mientras continúe el
              exceso.
            </Alert>
          ) : null}
          <p className="text-sm">
            Ampliaciones recurrentes: {b.library_extension_quantity} × 10 h ·{" "}
            {formatPlatformPrice(b.library_extension_quantity * 800)}/mes.
          </p>
        </Card>
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Reproducción compartida</h3>
          {c ? (
            <>
              <p>
                Ciclo: {date(c.starts_at)} – {date(c.ends_at)}
              </p>
              <p>
                Confirmada:{" "}
                {s.confirmedKnown
                  ? `${minutes(s.confirmedSeconds)} min`
                  : "pendiente de datos fiables"}
                .
              </p>
              <p>
                Base:{" "}
                {s.confirmedKnown ? minutes(c.base_used_seconds) : "pendiente"}{" "}
                / {minutes(c.base_seconds)} min. Gracia:{" "}
                {s.confirmedKnown ? minutes(c.grace_used_seconds) : "pendiente"}{" "}
                / {minutes(c.grace_seconds)} min.
              </p>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Sin ciclo comercial conciliado. Medición de los últimos 30 días.
              </p>
              <p>
                Confirmada:{" "}
                {s.confirmedKnown
                  ? `${minutes(s.confirmedSeconds)} min`
                  : "pendiente de datos fiables"}
                .
              </p>
            </>
          )}
          <p className="text-sm text-muted-foreground">
            Estimación reciente:{" "}
            {s.estimatedSeconds === null
              ? "pendiente de telemetría"
              : `${minutes(s.estimatedSeconds)} min aproximados`}
            ; se muestra separada del uso confirmado.{" "}
            {s.updatedAt
              ? `Última actualización fiable: ${date(s.updatedAt)}.`
              : "Todavía no hay actualización fiable."}
          </p>
          {s.pending ? (
            <Alert variant="info">
              Actualización pendiente. La falta de datos no significa consumo
              cero. {s.missingHours} horas de cobertura pendientes.{" "}
              {s.confirmedUntil
                ? `Cobertura continua hasta ${date(s.confirmedUntil)}.`
                : "Aún no hay cobertura continua de toda la ventana."}
            </Alert>
          ) : null}
        </Card>
      </div>
      <Card className="space-y-3 p-5">
        <h3 className="font-semibold">Bolsas de reproducción</h3>
        {s.packs.length ? (
          <ul className="space-y-3">
            {s.packs.map((p) => (
              <li
                key={p.id}
                className="flex flex-col justify-between gap-1 text-sm sm:flex-row"
              >
                <span>{minutes(p.remaining_seconds)} minutos restantes</span>
                <span>
                  {p.expired ? "Vencida" : "Vence"}: {date(p.expires_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay bolsas. Son pagos únicos y no se renuevan automáticamente.
          </p>
        )}
      </Card>
      <p className="text-sm text-muted-foreground">
        Última factura registrada:{" "}
        {invoice
          ? `${formatPlatformPrice(invoice.amount_paid_cents)} pagados el ${date(invoice.paid_at)}`
          : "importe real pendiente de conciliación"}
        . El precio, descuentos y facturas de Stripe prevalecen para tus cobros.
      </p>
      {s.operations.length ? (
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold">Operaciones pendientes</h3>
          {s.operations.map((op) => (
            <div key={op.id} className="space-y-3">
              <p className="text-sm">
                {(
                  {
                    subscribe: "Contratación",
                    delivery_pack: "Bolsa de reproducción",
                    library: "Ampliación de biblioteca",
                    upgrade: "Aumento de plan",
                    downgrade: "Reducción programada",
                    cancel: "Cancelación",
                    resume: "Continuidad",
                  } as Record<string, string>
                )[op.kind] ?? "Cambio de capacidad"}
                :{" "}
                {op.status === "scheduled"
                  ? "programado para la renovación"
                  : "pendiente de confirmar"}
                {op.last_error ? " · requiere conciliación" : ""}.
              </p>
              {controls && op.status !== "scheduled" ? (
                <CapacityRecovery
                  organizationId={organizationId}
                  operationId={op.id}
                  checkout={Boolean(op.checkout_attempt_id)}
                />
              ) : null}
            </div>
          ))}
        </Card>
      ) : null}
      {controls ? (
        <a
          href={`/api/admin/content-export?organizationId=${organizationId}`}
          className="inline-block text-sm underline"
        >
          Extraer tus datos y contenido disponible
        </a>
      ) : null}
      {b.retention_until ? (
        <Alert variant="info">
          Conservamos tu contenido hasta {date(b.retention_until)}. Puedes
          recuperar la suscripción o{" "}
          <a
            href={`/api/admin/content-export?organizationId=${organizationId}`}
            className="underline"
          >
            extraer tus datos y contenido disponible
          </a>
          . Las facturas se conservan por separado.
        </Alert>
      ) : null}
      {controls &&
      !hasBlockingOperation &&
      b.trial_initialization_status !== "pending" ? (
        <CapacityControls
          organizationId={organizationId}
          planKey={b.plan_key}
          libraryQuantity={b.library_extension_quantity}
          subscriptionActive={Boolean(
            b.platform_subscription_id &&
              ["active", "past_due"].includes(b.platform_subscription_status),
          )}
          enabled={plansEnabledForSchool(organizationId)}
          fiscalScopeRequired={fiscalPolicyRequired()}
        />
      ) : null}
    </section>
  );
}
