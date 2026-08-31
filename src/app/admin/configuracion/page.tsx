import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { stripe } from "@/lib/stripe/client";
import { describeStripeError } from "@/lib/stripe/errors";
import { Alert } from "@/components/ui/Alert";
import { StripeConnectButton } from "./StripeConnectButton";
import { PLATFORM_NAME } from "@/lib/brand";

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
    .select("stripe_account_id, stripe_connect_status")
    .eq("organization_id", membership.organizationId)
    .maybeSingle();

  let stripeStatus = integrations?.stripe_connect_status ?? null;

  // Al volver del onboarding de Stripe, re-consulta el estado real de la
  // cuenta — el webhook de Connect podría no haber llegado todavía (sobre
  // todo en local, sin túnel público configurado para recibirlo).
  //
  // En try/catch porque una cuenta borrada en Stripe (o una clave de otro modo)
  // haría reventar la página entera, dejando al owner sin forma de reconectar.
  let stripeError: string | null = null;
  if (stripeReturn === "return" && integrations?.stripe_account_id) {
    try {
      const account = await stripe.accounts.retrieve(
        integrations.stripe_account_id
      );
      stripeStatus =
        account.charges_enabled &&
        account.payouts_enabled &&
        account.details_submitted
          ? "connected"
          : "pending";

      await supabase
        .from("organization_integrations")
        .update({ stripe_connect_status: stripeStatus })
        .eq("organization_id", membership.organizationId);
    } catch (error) {
      stripeError = describeStripeError(error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Configuración de cobros</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Conecta tu propia cuenta de Stripe para que el dinero de tus ventas te
        llegue directamente a ti, no a la plataforma.
      </p>

      <div className="mt-8 rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Stripe</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {stripeStatus
            ? STRIPE_STATUS_LABEL[stripeStatus] ?? stripeStatus
            : "Todavía no conectado — las ventas con tarjeta permanecerán bloqueadas hasta terminar la conexión."}
        </p>
        {stripeError && (
          <Alert variant="error" className="mt-4">
            {stripeError}
          </Alert>
        )}

        <StripeConnectButton isConnected={Boolean(stripeStatus)} />

        <p className="mt-4 text-xs text-muted-foreground">
          Stripe te pedirá tu documento de identidad y una cuenta bancaria: es
          un requisito legal para poder recibir dinero, no lo decide {PLATFORM_NAME}.
          Ya te llevamos el país, el tipo de cuenta y tus datos rellenos, y solo
          te pedirá lo imprescindible para empezar a cobrar.
        </p>
      </div>
    </div>
  );
}
