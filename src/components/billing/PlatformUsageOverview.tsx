import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { getSchoolUsageSnapshot } from "@/lib/billing/usageSnapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPlatformPrice } from "@/lib/billing/access";

/** Caller must requireSuperAdmin. Uses the same canonical snapshot as school billing. */
export async function PlatformUsageOverview({ organizations }: { organizations: { id: string; name: string }[] }) {
  const snapshots=await Promise.all(organizations.map(async o=>({ organization:o, snapshot:await getSchoolUsageSnapshot(o.id) })));
  const unattributed=await createAdminClient().from("mux_usage_hours").select("delivered_seconds").is("organization_id",null);
  const requests=await createAdminClient().from("platform_custom_requests").select("id,message,created_at,organization_id").order("created_at",{ascending:false}).limit(20);
  return <section className="space-y-5" aria-label="Economía y consumo de escuelas"><h2 className="text-xl font-semibold">Economía y consumo</h2><p className="text-sm text-muted-foreground">Costes de referencia en USD, separados de los cobros en EUR. No se presenta beneficio neto: faltan conciliación de Mux, créditos/descuentos de cuenta, otros proveedores y gastos operativos.</p>
    <div className="grid gap-4 lg:grid-cols-2">{snapshots.map(({organization:o,snapshot:s})=><Card key={o.id} className="space-y-3 p-5"><h3 className="font-semibold">{o.name}</h3>{s.kind==="error" ? <Alert variant="info">{s.message}</Alert> : <>
      <p className="text-sm">{s.billing.accepted_offer?.name ?? "Oferta anterior"} · {s.billing.quota_mode} · {s.billing.platform_subscription_status}</p>
      <p className="text-sm">Ingreso registrado: {s.invoices.length ? formatPlatformPrice(s.invoices.filter(i=>i.currency==="eur").reduce((n,i)=>n+i.amount_paid_cents,0)) : "desconocido"} (hasta 12 facturas; no es ingreso neto).</p>
      <p className="text-sm">Biblioteca {(Number(s.library.active_seconds)/3600).toLocaleString("es-ES",{maximumFractionDigits:2})} h; reservas {(Number(s.library.reserved_seconds)/3600).toLocaleString("es-ES",{maximumFractionDigits:2})} h; compromiso pendiente {(Number(s.library.committed_seconds)/3600).toLocaleString("es-ES",{maximumFractionDigits:2})} h.</p>
      <p className="text-sm">Entrega confirmada: {s.confirmedKnown && s.cycle ? `${(Number(s.cycle.base_used_seconds)/60).toLocaleString("es-ES")} min de base` : "pendiente"}. Gracia: {s.confirmedKnown && s.cycle ? `${Number(s.cycle.grace_used_seconds)/60}/${Number(s.cycle.grace_seconds)/60} min` : "pendiente"}.</p>
      <p className="text-sm">Coste bruto atribuido: pendiente de exportación/factura del proveedor. Referencia de almacenamiento mensual estable Basic 1080p: {((Number(s.library.active_seconds)+Number(s.library.committed_seconds))/60*.003).toLocaleString("es-ES",{style:"currency",currency:"USD"})}. Es una referencia histórica fechada 2026-10-01, no un coste facturado.</p>
      <p className="text-sm">Exposición económica máxima de duración: {Number(s.billing.economic_limit_seconds)/3600} h. Un alta prorrateada no reduce el mínimo de 30 días del proveedor.</p>
      <p className="text-sm">Última actualización fiable: {s.updatedAt ?? "pendiente"}. Excepciones vigentes: {s.exceptions.length}; avisos registrados: {s.notices.length}; conservación: {s.retention?.status ?? "sin trabajo"}.</p>
    </>}</Card>)}</div>
    <Alert variant="info">Entrega sin atribución: {unattributed.error ? "desconocida" : `${(unattributed.data.reduce((n,r)=>n+Number(r.delivered_seconds),0)/60).toLocaleString("es-ES")} minutos confirmados`}. No se reparte entre escuelas por suposición. Factura general Mux, créditos y pago de cuenta: pendientes de conciliación independiente.</Alert>
    {requests.error ? <Alert variant="info">Solicitudes A medida pendientes de lectura.</Alert> : requests.data.length ? <Card className="space-y-3 p-5"><h3 className="font-semibold">Solicitudes A medida</h3><ul className="space-y-3">{requests.data.map(r=><li key={r.id} className="whitespace-pre-wrap break-words text-sm">{r.created_at} · {r.organization_id ?? "sin escuela"}: {r.message}</li>)}</ul></Card> : null}
  </section>;
}
