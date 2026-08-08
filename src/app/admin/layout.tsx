import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminBillingGate } from "@/components/layout/AdminBillingGate";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";

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
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      supabase.rpc("is_super_admin"),
      getCurrentOrgMembership(supabase, user.id),
    ]);

  if (!membership && !isSuperAdmin) {
    redirect("/");
  }

  const { data: billing } = membership
    ? await supabase
        .from("organization_billing")
        .select("platform_subscription_status")
        .eq("organization_id", membership.organizationId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-screen flex-1 bg-background text-foreground">
      <AdminSidebar adminName={profile?.name ?? ""} />
      <main className="min-w-0 flex-1">
        <AdminBillingGate status={billing?.platform_subscription_status ?? null}>
          {children}
        </AdminBillingGate>
      </main>
    </div>
  );
}
