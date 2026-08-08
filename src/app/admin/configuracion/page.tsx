import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { stripe } from "@/lib/stripe/client";
import { buttonClassName } from "@/components/ui/Button";
import { connectStripeAction } from "./actions";
import { WhopForm } from "./WhopForm";

const STRIPE_STATUS_LABEL: Record<string, string> = {
  connected: "Conectado ✓",
  pending: "Conexión iniciada, pendiente de completar en Stripe",
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const { stripe: stripeReturn } = await searchParams;
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
        <h1 className="text-2xl font-bold tracking-tight">Configuración de cobros</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          No perteneces a ninguna organización.
        </p>
      </div>
    );
  }

  if (membership.role !== "owner") {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Configuración de cobros</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          Solo el propietario de la empresa puede ver y configurar los cobros.
        </p>
      </div>
    );
  }

  const { data: integrations } = await supabase
    .from("organization_integrations")
    .select(
      "stripe_account_id, stripe_connect_status, whop_product_id, whop_api_key_encrypted"
    )
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  let stripeStatus = integrations?.stripe_connect_status ?? null;

  // Al volver del onboarding de Stripe, re-consulta el estado real de la
  // cuenta — el webhook de Connect podría no haber llegado todavía (sobre
  // todo en local, sin túnel público configurado para recibirlo).
  if (stripeReturn === "return" && integrations?.stripe_account_id) {
    const account = await stripe.accounts.retrieve(integrations.stripe_account_id);
    stripeStatus =
      account.charges_enabled && account.details_submitted
        ? "connected"
        : "pending";

    await supabase
      .from("organization_integrations")
      .update({ stripe_connect_status: stripeStatus })
      .eq("organization_id", membership.organizationId);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Configuración de cobros</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Conecta tu propia cuenta de Stripe y/o Whop para que el dinero de tus
        ventas te llegue directamente a ti, no a la plataforma.
      </p>

      <div className="mt-8 rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Stripe</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {stripeStatus
            ? STRIPE_STATUS_LABEL[stripeStatus] ?? stripeStatus
            : "Todavía no conectado — las ventas con tarjeta se cobran hoy en la cuenta principal de la plataforma."}
        </p>
        <form action={connectStripeAction} className="mt-4">
          <button type="submit" className={buttonClassName("primary", "md")}>
            {stripeStatus ? "Revisar conexión con Stripe" : "Conectar con Stripe"}
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Whop</h2>
        <WhopForm
          hasWhopKey={Boolean(integrations?.whop_api_key_encrypted)}
          whopProductId={integrations?.whop_product_id ?? ""}
        />
      </div>
    </div>
  );
}
