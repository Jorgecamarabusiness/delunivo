import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { redirect } from "next/navigation";
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
import { RunAsButton } from "./RunAsButton";

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

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string }>;
}) {
  const supabase = await createClient();
  const { error: authError } = await requireSuperAdmin(supabase);

  if (authError) {
    redirect("/admin");
  }

  const admin = createAdminClient();
  const [
    { data: settings },
    { data: organizations },
    { data: billingRows },
    { data: referralRows },
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
        "organization_id, platform_subscription_status, platform_subscription_id, access_mode, access_expires_at, discount_percent, discount_duration, effective_discount_percent, affiliate_discount_cap_percent, referral_welcome_remaining_payments, commercial_note, updated_at"
      ),
    admin
      .from("organization_referrals")
      .select("referrer_organization_id, status"),
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
  const referralSummary = new Map<string, { active: number; pending: number }>();
  for (const referral of referralRows ?? []) {
    const current = referralSummary.get(referral.referrer_organization_id) ?? {
      active: 0,
      pending: 0,
    };
    if (referral.status === "active") current.active += 1;
    if (referral.status === "pending") current.pending += 1;
    referralSummary.set(referral.referrer_organization_id, current);
  }

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
      ownerUserId: organization.owner_id,
      statusLabel,
      statusVariant: paying ? ("solid" as const) : ("outline" as const),
      stripeStatus: STRIPE_STATUS[stripeStatus] ?? stripeStatus,
      hasStripeSubscription: Boolean(billing?.platform_subscription_id),
      accessMode,
      accessExpiresAt,
      discountPercent: billing?.discount_percent ?? 0,
      discountDuration: (billing?.discount_duration ?? "once") as DiscountDuration,
      effectiveDiscountPercent: billing?.effective_discount_percent ?? 0,
      affiliateDiscountCapPercent:
        billing?.affiliate_discount_cap_percent ?? 50,
      referralWelcomeRemainingPayments:
        billing?.referral_welcome_remaining_payments ?? 0,
      activeReferrals: referralSummary.get(organization.id)?.active ?? 0,
      pendingReferrals: referralSummary.get(organization.id)?.pending ?? 0,
      commercialNote: billing?.commercial_note ?? null,
      updatedAt: billing?.updated_at ?? "",
    };
  });

  const requestedOrganizationId = (await searchParams).organization ?? "";
  const selectedOrganizationId = (organizations ?? []).some(
    (organization) => organization.id === requestedOrganizationId
  )
    ? requestedOrganizationId
    : "";
  let studentsQuery = admin
    .from("organization_students")
    .select("organization_id, user_id, status, joined_via, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (selectedOrganizationId) {
    studentsQuery = studentsQuery.eq("organization_id", selectedOrganizationId);
  }
  const { data: studentRows } = await studentsQuery;
  const studentUserIds = [
    ...new Set((studentRows ?? []).map((student) => student.user_id)),
  ];
  const { data: studentProfiles } = studentUserIds.length
    ? await admin
        .from("profiles")
        .select("id, name, email")
        .in("id", studentUserIds)
    : { data: [] };
  const studentProfilesById = new Map(
    (studentProfiles ?? []).map((profile) => [profile.id, profile])
  );
  const organizationsById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization])
  );

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

      <section id="alumnos" className="mt-12 scroll-mt-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Alumnos</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vista global de alumnos. El filtro se aplica en servidor y no amplía
              los permisos de los administradores de empresa.
            </p>
          </div>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label htmlFor="organization-filter" className="text-xs font-medium text-muted-foreground">
              Empresa
            </label>
            <select
              id="organization-filter"
              name="organization"
              defaultValue={selectedOrganizationId}
              className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {(organizations ?? []).map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-11 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
            >
              Filtrar
            </button>
          </form>
        </div>

        {!studentRows?.length ? (
          <p className="mt-5 rounded-lg border border-border p-5 text-sm text-muted-foreground">
            No hay alumnos para este filtro.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="px-4 py-3 font-semibold">Alumno</th>
                  <th className="px-4 py-3 font-semibold">Empresa</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                  <th className="px-4 py-3 font-semibold">Origen</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Soporte</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((student, index) => {
                  const profile = studentProfilesById.get(student.user_id);
                  const studentOrganization = organizationsById.get(
                    student.organization_id
                  );
                  return (
                    <tr
                      key={`${student.organization_id}-${student.user_id}`}
                      className={index < studentRows.length - 1 ? "border-b border-border" : ""}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{profile?.name || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email || "Sin email"}</p>
                      </td>
                      <td className="px-4 py-3">{studentOrganization?.name ?? "Empresa eliminada"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {shortDate(student.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {student.joined_via === "purchase"
                          ? "Compra"
                          : student.joined_via === "invite"
                            ? "Invitación"
                            : "Registro"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={student.status === "active" ? "solid" : "outline"}>
                          {student.status === "active" ? "Activo" : "Echado"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RunAsButton
                          targetUserId={student.user_id}
                          targetName={profile?.email ?? profile?.name ?? "este alumno"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(studentRows?.length ?? 0) === 200 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Se muestran los 200 alumnos más recientes. Filtra por empresa para acotar la lista.
          </p>
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
