import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/Input";
import { PLATFORM_NAME } from "@/lib/brand";
import {
  formatPlatformPrice,
  hasComplimentaryAccess,
  isFutureDate,
  resolveEffectiveBillingStatus,
} from "@/lib/billing/access";
import { getPlatformPriceCents } from "@/lib/billing/platform";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { BillingActions } from "./BillingActions";
import { AffiliatePanel } from "./AffiliatePanel";
import { createAdminClient } from "@/lib/supabase/admin";

const STATUS_LABEL: Record<string, string> = {
  trialing: "En periodo de prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
};

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; empresa?: string }>;
}) {
  const { checkout, empresa } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ownerMemberships } = user
    ? await supabase
        .from("organization_admins")
        .select("organization_id, created_at")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .order("created_at", { ascending: true })
    : { data: [] };
  const ownerOrganizationIds = (ownerMemberships ?? []).map(
    (membership) => membership.organization_id
  );

  if (ownerOrganizationIds.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
        <p className="mt-8 text-sm text-muted-foreground">
          Solo el propietario de una empresa puede gestionar su facturación.
        </p>
      </div>
    );
  }

  const currentMembership = user
    ? await getCurrentOrgMembership(supabase, user.id)
    : null;
  const defaultOrganizationId =
    currentMembership &&
    ownerOrganizationIds.includes(currentMembership.organizationId)
      ? currentMembership.organizationId
      : ownerOrganizationIds[0];
  const selectedOrganizationId =
    empresa && ownerOrganizationIds.includes(empresa)
      ? empresa
      : defaultOrganizationId;
  const { data: ownerOrganizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", ownerOrganizationIds)
    .order("name", { ascending: true });
  const selectedOrganization = ownerOrganizations?.find(
    (organization) => organization.id === selectedOrganizationId
  );

  const admin = createAdminClient();
  const [
    { data: billing },
    priceCents,
    { data: referralCode },
    { data: referrals },
  ] = await Promise.all([
    admin
      .from("organization_billing")
      .select(
        "platform_subscription_status, platform_stripe_customer_id, platform_subscription_id, access_mode, access_expires_at, discount_percent, discount_duration, effective_discount_percent, affiliate_discount_cap_percent, referral_welcome_remaining_payments"
      )
      .eq("organization_id", selectedOrganizationId)
      .maybeSingle(),
    getPlatformPriceCents(),
    admin
      .from("organization_referral_codes")
      .select("code")
      .eq("organization_id", selectedOrganizationId)
      .eq("is_active", true)
      .maybeSingle(),
    admin
      .from("organization_referrals")
      .select("status")
      .eq("referrer_organization_id", selectedOrganizationId),
  ]);
  const activeReferrals = (referrals ?? []).filter(
    (referral) => referral.status === "active"
  ).length;
  const pendingReferrals = (referrals ?? []).filter(
    (referral) => referral.status === "pending"
  ).length;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const referralUrl = referralCode?.code
    ? `${siteUrl}/referidos/${referralCode.code}`
    : null;

  const status =
    resolveEffectiveBillingStatus({
      platformSubscriptionStatus:
        billing?.platform_subscription_status ?? "canceled",
      accessMode: billing?.access_mode,
      accessExpiresAt: billing?.access_expires_at,
    }) ?? "canceled";
  const complimentary = hasComplimentaryAccess({
    platformSubscriptionStatus:
      billing?.platform_subscription_status ?? "canceled",
    accessMode: billing?.access_mode,
    accessExpiresAt: billing?.access_expires_at,
  });
  const canManage = Boolean(
    status !== "canceled" &&
      billing?.platform_stripe_customer_id &&
      billing.platform_subscription_id
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {selectedOrganization?.name ?? "Tu empresa"} · Suscripción a {PLATFORM_NAME}{" "}
        — {formatPlatformPrice(priceCents)}/mes.
      </p>

      {ownerOrganizationIds.length > 1 ? (
        <form
          method="get"
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1 text-sm font-medium">
            Empresa
            <select
              name="empresa"
              defaultValue={selectedOrganizationId}
              className={`${inputClassName} mt-1`}
            >
              {(ownerOrganizations ?? []).map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className={buttonClassName("outline", "md")}
          >
            Ver facturación
          </button>
        </form>
      ) : null}

      {checkout === "success" ? (
        <Alert variant="success" className="mt-6">
          Pago confirmado. Puede tardar unos segundos en reflejarse aquí.
        </Alert>
      ) : null}
      {checkout === "cancelled" ? (
        <Alert variant="info" className="mt-6">
          Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
        </Alert>
      ) : null}

      <div className="mt-8 rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">Estado</p>
        <p className="mt-1 text-lg font-semibold">
          {complimentary
            ? "Acceso gratuito por invitación"
            : STATUS_LABEL[status] ?? status}
        </p>

        {billing?.access_expires_at &&
        billing.access_mode === "trial" &&
        isFutureDate(billing.access_expires_at) ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Válido hasta el{" "}
            {new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(
              new Date(billing.access_expires_at)
            )}
            .
          </p>
        ) : null}
        {!complimentary && (billing?.effective_discount_percent ?? 0) > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Tu descuento efectivo actual es del{" "}
            {billing!.effective_discount_percent}%.
            {(billing?.referral_welcome_remaining_payments ?? 0) > 0
              ? ` Incluye la bienvenida de referido durante ${billing!.referral_welcome_remaining_payments} mensualidades pagadas más.`
              : ""}
          </p>
        ) : null}

        {status === "past_due" ? (
          <p className="mt-2 text-sm text-red-600">
            Hubo un problema con tu último pago. Si no se resuelve, tu panel de
            administración se bloqueará; tus alumnos mantienen sus cursos.
          </p>
        ) : null}
        {status === "canceled" ? (
          <p className="mt-2 text-sm text-red-600">
            La suscripción está cancelada y el panel de esta empresa está
            bloqueado. Reactívala para recuperar el acceso.
          </p>
        ) : null}

        <BillingActions
          organizationId={selectedOrganizationId}
          canManage={canManage}
          status={status}
          complimentaryWithoutStripe={complimentary && !canManage}
        />
      </div>

      <AffiliatePanel
        organizationId={selectedOrganizationId}
        referralUrl={referralUrl}
        activeReferrals={activeReferrals}
        pendingReferrals={pendingReferrals}
        effectiveDiscountPercent={billing?.effective_discount_percent ?? 0}
        discountCapPercent={billing?.affiliate_discount_cap_percent ?? 50}
      />
    </div>
  );
}
