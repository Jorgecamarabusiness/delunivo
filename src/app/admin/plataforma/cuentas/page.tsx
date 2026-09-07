import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformAccountsPage() {
  const supabase = await createClient();
  const { error: authError } = await requireSuperAdmin(supabase);
  if (authError) redirect("/admin");

  // La autorización se comprueba por RPC con la sesión actual antes de usar el
  // cliente de servidor para enumerar cuentas globales.
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, email, is_super_admin")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <Link href="/admin/plataforma" className="text-sm font-medium underline underline-offset-4">
        ← Volver al control de Delunivo
      </Link>
      <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Cuentas</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Gestión global exclusiva de superadministración. La eliminación se revisa
        cuenta por cuenta y nunca se ejecuta desde el panel de una escuela.
      </p>

      {error ? <Alert variant="error" className="mt-6">No se pudieron cargar las cuentas.</Alert> : null}
      {!error && !profiles?.length ? (
        <p className="mt-6 rounded-lg border border-border p-5 text-sm text-muted-foreground">
          No hay cuentas que mostrar.
        </p>
      ) : null}
      {profiles?.length ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Cuenta</th>
                <th className="px-4 py-3 font-semibold">Correo</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile, index) => (
                <tr key={profile.id} className={index < profiles.length - 1 ? "border-b border-border" : ""}>
                  <td className="px-4 py-3 font-medium">{profile.name || "Sin nombre"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{profile.email}</td>
                  <td className="px-4 py-3">
                    {profile.is_super_admin ? "Superadministración" : "Cuenta"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/cuenta/eliminar?target=${encodeURIComponent(profile.id)}`}
                      className={buttonClassName("danger", "sm")}
                    >
                      Revisar eliminación
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
