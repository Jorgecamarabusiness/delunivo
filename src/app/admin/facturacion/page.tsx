import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { Alert } from "@/components/ui/Alert";
import { BillingActions } from "./BillingActions";

const STATUS_LABEL: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = user
    ? await getCurrentOrgMembership(supabase, user.id)
    : null;

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          No perteneces a ninguna organización.
        </p>
      </div>
    );
  }

  if (membership.role !== "owner") {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          Solo el propietario de la empresa puede ver y gestionar la
          facturación.
        </p>
      </div>
    );
  }

  const { data: billing } = await supabase
    .from("organization_billing")
    .select("platform_subscription_status, platform_stripe_customer_id")
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  const status = billing?.platform_subscription_status ?? "trialing";
  // El portal de Stripe necesita un cliente real. Una empresa marcada como
  // 'active' sin `platform_stripe_customer_id` (estado sembrado a mano, o un
  // webhook que nunca llegó) no tiene nada que gestionar todavía: se le ofrece
  // suscribirse, que es lo que de verdad le falta.
  const canManage =
    status === "active" && Boolean(billing?.platform_stripe_customer_id);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu suscripción a Aularia — 20€/mes.
      </p>

      {checkout === "success" && (
        <Alert variant="success" className="mt-6">
          Pago confirmado. Puede tardar unos segundos en reflejarse aquí.
        </Alert>
      )}
      {checkout === "cancelled" && (
        <Alert variant="info" className="mt-6">
          Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
        </Alert>
      )}

      <div className="mt-8 rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">Estado</p>
        <p className="mt-1 text-lg font-semibold">
          {STATUS_LABEL[status] ?? status}
        </p>

        {status === "past_due" && (
          <p className="mt-2 text-sm text-red-600">
            Hubo un problema con tu último pago. Si no se resuelve, tu panel
            de administración se bloqueará (tus alumnos con curso comprado
            mantienen su acceso).
          </p>
        )}
        {status === "canceled" && (
          <p className="mt-2 text-sm text-red-600">
            Tu suscripción está cancelada y tu panel de administración está
            bloqueado. Reactívala para recuperar el acceso.
          </p>
        )}

        <BillingActions canManage={canManage} status={status} />
      </div>
    </div>
  );
}
