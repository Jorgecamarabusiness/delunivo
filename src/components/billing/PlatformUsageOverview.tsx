import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { getSchoolUsageSnapshot } from "@/lib/billing/usageSnapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPlatformPrice } from "@/lib/billing/access";
import { getSchoolEconomics } from "@/lib/billing/economicsSnapshot";
import { PlatformCapacityTools } from "./PlatformCapacityTools";
import { readAllRows } from "@/lib/billing/readAllRows";
import { randomUUID } from "node:crypto";

/** Caller must requireSuperAdmin. Uses the same canonical snapshot as school billing. */
export async function PlatformUsageOverview({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const snapshots = await Promise.all(
    organizations.map(async (o) => {
      const snapshot = await getSchoolUsageSnapshot(o.id);
      return {
        organization: o,
        snapshot,
        economics: await getSchoolEconomics(
          o.id,
          snapshot.kind === "ready"
            ? (snapshot.cycle?.starts_at ?? null)
            : null,
          snapshot.kind === "ready" ? (snapshot.cycle?.ends_at ?? null) : null,
        ),
      };
    }),
  );
  const unattributed = await readAllRows((from, to) =>
    createAdminClient()
      .from("mux_usage_hours")
      .select("delivered_seconds")
      .is("organization_id", null)
      .order("starts_at")
      .order("environment")
      .order("mux_asset_id")
      .range(from, to),
  );
  const statements = await createAdminClient()
    .from("platform_provider_statements")
    .select(
      "id,provider,environment,currency,starts_at,ends_at,gross_cents,discount_cents,credit_cents,tax_cents,paid_cents,source",
    )
    .order("ends_at", { ascending: false })
    .limit(20);
  const requests = await createAdminClient()
    .from("platform_custom_requests")
    .select("id,message,created_at,organization_id,user_id")
    .order("created_at", { ascending: false })
    .limit(20);
  const contacts = requests.data?.length
    ? await createAdminClient()
        .from("profiles")
        .select("id,email")
        .in(
          "id",
          requests.data.map((r) => r.user_id),
        )
    : { data: [], error: null };
  return (
    <section className="space-y-5" aria-label="Economía y consumo de escuelas">
      <h2 className="text-xl font-semibold">Economía y consumo</h2>
      <p className="text-sm text-muted-foreground">
        Costes de referencia en USD, separados de los cobros en EUR. No se
        presenta beneficio neto: faltan conciliación de Mux, créditos/descuentos
        de cuenta, otros proveedores y gastos operativos.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {snapshots.map(({ organization: o, snapshot: s, economics: e }) => (
          <Card key={o.id} className="space-y-3 p-5">
            <h3 className="font-semibold">{o.name}</h3>
            {s.kind === "error" ? (
              <Alert variant="info">{s.message}</Alert>
            ) : (
              <>
                <p className="text-sm">
                  {s.billing.accepted_offer?.name ?? "Oferta anterior"} ·{" "}
                  {s.billing.quota_mode} ·{" "}
                  {s.billing.platform_subscription_status}
                </p>
                <p className="text-sm">
                  Ingreso registrado:{" "}
                  {s.invoices.length
                    ? formatPlatformPrice(
                        s.invoices
                          .filter((i) => i.currency === "eur")
                          .reduce((n, i) => n + i.amount_paid_cents, 0),
                      )
                    : "desconocido"}{" "}
                  (hasta 12 facturas; no es ingreso neto).
                </p>
                <p className="text-sm">
                  Biblioteca{" "}
                  {(Number(s.library.active_seconds) / 3600).toLocaleString(
                    "es-ES",
                    { maximumFractionDigits: 2 },
                  )}{" "}
                  h; reservas{" "}
                  {(Number(s.library.reserved_seconds) / 3600).toLocaleString(
                    "es-ES",
                    { maximumFractionDigits: 2 },
                  )}{" "}
                  h; compromiso pendiente{" "}
                  {(Number(s.library.committed_seconds) / 3600).toLocaleString(
                    "es-ES",
                    { maximumFractionDigits: 2 },
                  )}{" "}
                  h.
                </p>
                <p className="text-sm">
                  Entrega confirmada:{" "}
                  {s.confirmedKnown && s.cycle
                    ? `${(Number(s.cycle.base_used_seconds) / 60).toLocaleString("es-ES")} min de base`
                    : "pendiente"}
                  . Gracia:{" "}
                  {s.confirmedKnown && s.cycle
                    ? `${Number(s.cycle.grace_used_seconds) / 60}/${Number(s.cycle.grace_seconds) / 60} min`
                    : "pendiente"}
                  .
                </p>
                <p className="text-sm">
                  Coste bruto atribuido en ventanas completas de fuente:{" "}
                  {e.costs
                    ? Object.entries(e.costs)
                        .map(([currency, amount]) =>
                          amount.toLocaleString("es-ES", {
                            style: "currency",
                            currency: currency.toUpperCase(),
                          }),
                        )
                        .join(" · ")
                    : "pendiente de fuente atribuible"}
                  . Referencia de almacenamiento mensual estable Basic 1080p:{" "}
                  {(
                    ((Number(s.library.active_seconds) +
                      Number(s.library.committed_seconds)) /
                      60) *
                    0.003
                  ).toLocaleString("es-ES", {
                    style: "currency",
                    currency: "USD",
                  })}
                  . Es una referencia histórica fechada 2026-10-01, no un coste
                  facturado.
                </p>
                <p className="text-sm">
                  Referencia de entrega Basic 1080p:{" "}
                  {s.confirmedKnown
                    ? ((s.confirmedSeconds / 60) * 0.001).toLocaleString(
                        "es-ES",
                        { style: "currency", currency: "USD" },
                      )
                    : "pendiente"}
                  . Margen parcial registrado:{" "}
                  {e.partialMarginEur === null
                    ? "desconocido (impuestos, coste o cambio pendientes)"
                    : e.partialMarginEur.toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                  .
                </p>
                <p className="text-xs text-muted-foreground">{e.reason}</p>
                <p className="text-sm">
                  Supabase Storage atribuible:{" "}
                  {e.storageBytes === null
                    ? "pendiente"
                    : `${(e.storageBytes / 1024 / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MiB de inventario`}
                  . Archivos compartidos o tamaño pendiente:{" "}
                  {e.unknownStorageFiles ?? "desconocido"}. El inventario no
                  sustituye la factura ni mide transferencia de otros
                  proveedores.
                </p>
                <p className="text-sm">
                  Exposición económica máxima de duración:{" "}
                  {Number(s.billing.economic_limit_seconds) / 3600} h. Un alta
                  prorrateada no reduce el mínimo de 30 días del proveedor.
                </p>
                <p className="text-sm">
                  Última actualización fiable: {s.updatedAt ?? "pendiente"}.
                  Excepciones vigentes: {s.exceptions.length}; avisos
                  registrados: {s.notices.length}; conservación:{" "}
                  {s.retention?.status ?? "sin trabajo"}.
                </p>
                {s.exceptions.length ? (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {s.exceptions.map((x) => (
                      <li key={x.id}>
                        {x.resource} · {x.quantity_seconds} s · hasta{" "}
                        {x.expires_at} · autor {x.actor_id}: {x.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </Card>
        ))}
      </div>
      <Alert variant="info">
        Entrega sin atribución:{" "}
        {unattributed.error ||
        !snapshots.some(
          (r) => r.snapshot.kind === "ready" && r.snapshot.confirmedKnown,
        )
          ? "desconocida"
          : `${(unattributed.data.reduce((n, r) => n + Number(r.delivered_seconds), 0) / 60).toLocaleString("es-ES")} minutos confirmados`}
        . No se reparte entre escuelas por suposición.
      </Alert>
      <Card className="space-y-3 p-5">
        <h3 className="font-semibold">Facturas de cuenta y créditos</h3>
        {statements.error || !statements.data?.length ? (
          <p className="text-sm text-muted-foreground">
            Pendientes de conciliación independiente. La ausencia de una factura
            no se interpreta como pago cero.
          </p>
        ) : (
          <ul className="space-y-3">
            {statements.data.map((s) => (
              <li key={s.id} className="break-words text-sm">
                {s.provider} · {s.environment} · {s.starts_at} – {s.ends_at}:
                bruto {s.gross_cents / 100} {s.currency}, descuentos{" "}
                {s.discount_cents / 100}, créditos {s.credit_cents / 100},
                impuestos {s.tax_cents / 100}, pago {s.paid_cents / 100}.
                Fuente: {s.source}.
              </li>
            ))}
          </ul>
        )}
      </Card>
      <PlatformCapacityTools
        organizations={organizations}
        nonce={randomUUID()}
      />
      {requests.error ? (
        <Alert variant="info">
          Solicitudes A medida pendientes de lectura.
        </Alert>
      ) : requests.data.length ? (
        <Card className="space-y-3 p-5">
          <h3 className="font-semibold">Solicitudes A medida</h3>
          <ul className="space-y-3">
            {requests.data.map((r) => (
              <li
                key={r.id}
                className="whitespace-pre-wrap break-words text-sm"
              >
                {r.created_at} ·{" "}
                {contacts.data?.find((c) => c.id === r.user_id)?.email ??
                  "contacto pendiente"}{" "}
                · {r.organization_id ?? "sin escuela"}: {r.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
