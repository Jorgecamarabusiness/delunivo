import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminBillingGate } from "@/components/layout/AdminBillingGate";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { resolveEffectiveBillingStatus } from "@/lib/billing/access";
import { AdminPageBackLink } from "@/components/layout/AdminPageBackLink";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: isSuperAdmin }, membership] =
    await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
      supabase.rpc("is_super_admin"),
      getCurrentOrgMembership(supabase, user.id),
    ]);

  if (!membership && !isSuperAdmin) {
    redirect("/");
  }

  const [{ data: billing }, { data: organization }] = membership
    ? await Promise.all([
        supabase
          .from("organization_billing")
          .select("platform_subscription_status, access_mode, access_expires_at")
          .eq("organization_id", membership.organizationId)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("slug")
          .eq("id", membership.organizationId)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  return (
    <div className="flex min-h-screen flex-1 bg-background text-foreground">
      <AdminSidebar
        adminName={profile?.name ?? ""}
        organizationHref={organization ? `/o/${organization.slug}` : undefined}
        isSuperAdmin={Boolean(isSuperAdmin)}
      />
      <main className="min-w-0 flex-1">
        <AdminPageBackLink />
        <AdminBillingGate
          status={
            isSuperAdmin
              ? null
              : resolveEffectiveBillingStatus({
                  platformSubscriptionStatus:
                    billing?.platform_subscription_status ?? "canceled",
                  accessMode: billing?.access_mode,
                  accessExpiresAt: billing?.access_expires_at,
                })
          }
        >
          {children}
        </AdminBillingGate>
      </main>
    </div>
  );
}
