import { Alert } from "@/components/ui/Alert";
import { AddAdminEmailForm } from "@/app/admin/emails/AddAdminEmailForm";
import { AdminEmailRow } from "@/app/admin/emails/AdminEmailRow";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import {
  hasComplimentaryAccess,
  isFutureDate,
  resolveEffectiveBillingStatus,
  type CommercialAccessMode,
  type DiscountDuration,
} from "@/lib/billing/access";
import { getEmailDeliveryMode } from "@/lib/email/deliveryMode";
import { listAdminEmails } from "@/lib/email/adminEmails";
import { PLATFORM_NAME } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { OrganizationCommercialForm } from "./OrganizationCommercialForm";
import { PlatformPriceForm } from "./PlatformPriceForm";

const STRIPE_STATUS: Record<string, string> = {
  trialing: "en prueba",
  active: "activa",
  past_due: "pago pendiente",
  canceled: "cancelada",
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(
    new Date(value)
  );
}

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  const { error: authError } = await requireSuperAdmin(supabase);

  if (authError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Control de Delunivo</h1>
        <Alert variant="error" className="mt-8">{authError}</Alert>
      </div>
    );
  }

  const admin = createAdminClient();
  const [
    { data: settings },
    { data: organizations },
    { data: billingRows },
    entries,
  ] = await Promise.all([
    admin
      .from("platform_settings")
      .select("monthly_price_cents")
      .eq("id", true)
      .single(),
    admin
      .from("organizations")
      .select("id, name, slug, owner_id, created_at")
      .order("created_at", { ascending: true }),
    admin
      .from("organization_billing")
      .select(
        "organization_id, platform_subscription_status, platform_subscription_id, access_mode, access_expires_at, discount_percent, discount_duration, commercial_note"
      ),
    listAdminEmails(),
  ]);

  const ownerIds = [...new Set((organizations ?? []).map((organization) => organization.owner_id))];
  const { data: owners } = ownerIds.length
    ? await admin.from("profiles").select("id, name, email").in("id", ownerIds)
    : { data: [] };
  const ownersById = new Map((owners ?? []).map((owner) => [owner.id, owner]));
  const billingByOrg = new Map(
    (billingRows ?? []).map((billing) => [billing.organization_id, billing])
  );

  const companyCards = (organizations ?? []).map((organization) => {
    const billing = billingByOrg.get(organization.id);
    const accessMode = (billing?.access_mode ?? "standard") as CommercialAccessMode;
    const accessExpiresAt = billing?.access_expires_at ?? null;
    const stripeStatus = billing?.platform_subscription_status ?? "canceled";
    const effectiveStatus = resolveEffectiveBillingStatus({
      platformSubscriptionStatus: stripeStatus,
      accessMode,
      accessExpiresAt,
    });
    const complimentary = hasComplimentaryAccess({
      platformSubscriptionStatus: stripeStatus,
      accessMode,
      accessExpiresAt,
    });
    const trial = accessMode === "trial" && isFutureDate(accessExpiresAt);
    const paying =
      !complimentary &&
      !trial &&
      Boolean(billing?.platform_subscription_id) &&
      stripeStatus === "active";

    let statusLabel = effectiveStatus === "canceled" ? "Bloqueada" : "Activa";
    if (paying) statusLabel = "Pagando";
    else if (complimentary) {
      statusLabel = "Gratis sin caducidad";
    } else if (trial && accessExpiresAt) {
      statusLabel = `Prueba hasta ${shortDate(accessExpiresAt)}`;
    } else if (effectiveStatus === "past_due") statusLabel = "Pago pendiente";

    const owner = ownersById.get(organization.owner_id);
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      ownerLabel: owner?.email ?? owner?.name ?? "Propietario sin perfil",
      statusLabel,
      statusVariant: paying ? ("solid" as const) : ("outline" as const),
      stripeStatus: STRIPE_STATUS[stripeStatus] ?? stripeStatus,
      hasStripeSubscription: Boolean(billing?.platform_subscription_id),
      accessMode,
      accessExpiresAt,
      discountPercent: billing?.discount_percent ?? 0,
      discountDuration: (billing?.discount_duration ?? "once") as DiscountDuration,
      commercialNote: billing?.commercial_note ?? null,
    };
  });

  const emailDeliveryMode = getEmailDeliveryMode();
  const isLive = emailDeliveryMode === "live";
  const isOff = emailDeliveryMode === "off";
  const isProduction = process.env.VERCEL_ENV === "production";

  return (
    <div className="mx-auto min-w-0 w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Control de {PLATFORM_NAME}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Zona exclusiva de superadministradores para precio, empresas, ofertas y correos de prueba.
      </p>

      <section id="precio" className="mt-10 scroll-mt-6 rounded-lg border border-border p-5 sm:p-6">
        <h2 className="text-xl font-semibold">Precio de Delunivo</h2>
        <PlatformPriceForm priceCents={settings?.monthly_price_cents ?? 3000} />
      </section>

      <section id="empresas" className="mt-10 scroll-mt-6">
        <h2 className="text-xl font-semibold">Empresas</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          “Pagando” significa que existe una suscripción real en Stripe. El acceso gratuito y las pruebas quedan identificados por separado.
        </p>
        <div className="mt-5 grid gap-5">
          {companyCards.map((organization) => (
            <OrganizationCommercialForm
              key={organization.id}
              organization={organization}
            />
          ))}
        </div>
        {companyCards.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">Todavía no hay empresas.</p>
        ) : null}
      </section>

      <section id="correos" className="mt-12 scroll-mt-6">
        <h2 className="text-xl font-semibold">Correos de prueba</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          En desarrollo, verificaciones, recuperaciones e invitaciones se redirigen a esta lista. El destinatario real aparece en el asunto.
        </p>

        <Alert
          variant={isLive || isOff ? "warning" : isProduction ? "error" : "info"}
          className="mt-5"
        >
          {isLive
            ? "Envío real activado: esta lista se ignora en producción."
            : isOff
              ? "Envío desactivado: no saldrá ningún correo mientras EMAIL_DELIVERY_MODE sea off."
            : isProduction
              ? "Falta RESEND_FROM_EMAIL: producción sigue redirigiendo aquí para no perder correos."
              : "Modo desarrollo: ningún correo llega todavía a clientes reales."}
        </Alert>

        <AddAdminEmailForm />

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Correo</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <AdminEmailRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
        {entries.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            No hay correos configurados. Añade al menos uno para poder probar envíos.
          </p>
        ) : null}
      </section>
    </div>
  );
}
