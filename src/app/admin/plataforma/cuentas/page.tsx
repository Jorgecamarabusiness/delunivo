import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { buttonClassName } from "@/components/ui/Button";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/Input";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { retryDeletionJobAction } from "./actions";

export default async function PlatformAccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const supabase = await createClient();
  const { error: authError } = await requireSuperAdmin(supabase);
  if (authError) redirect("/admin");

  // La autorización se comprueba por RPC con la sesión actual antes de usar el
  // cliente de servidor para enumerar cuentas globales.
  const admin = createAdminClient();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 254);
  const page = Math.min(100000, Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0));
  let query = admin
    .from("profiles")
    .select("id, name, email, is_super_admin", { count: "exact" })
    .order("created_at", { ascending: true }).order("id")
    .range(page * 50, page * 50 + 49);
  if (q) query = query.ilike("email", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const [{ data: profiles, error, count }, { data: jobs, error: jobsError }] = await Promise.all([
    query,
    admin.from("account_deletion_jobs").select("id,status,stage,last_error_code,next_attempt_at")
      .neq("status", "completed").order("created_at").limit(100),
  ]);

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
      <form className="mt-6 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="account-search" className="mb-2 block text-sm font-medium">Buscar por correo</label>
          <Input id="account-search" name="q" defaultValue={q} maxLength={254} />
        </div>
        <button className={buttonClassName("neutral", "md")}>Buscar</button>
      </form>

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
      <nav aria-label="Páginas de cuentas" className="mt-4 flex gap-4 text-sm underline">
        {page > 0 ? <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`} className="inline-flex min-h-11 items-center">Anterior</Link> : null}
        {(count ?? 0) > (page + 1) * 50 ? <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`} className="inline-flex min-h-11 items-center">Siguiente</Link> : null}
      </nav>
      <section className="mt-10 border-t border-border pt-8" aria-labelledby="deletion-jobs-title">
        <h2 id="deletion-jobs-title" className="text-xl font-semibold">Eliminaciones en curso</h2>
        <p className="mt-2 text-sm text-muted-foreground">Los reintentos conservan las comprobaciones y el tiempo de espera de cada solicitud. Los archivos compartidos requieren resolver su propiedad antes de finalizar.</p>
        {jobsError ? <Alert variant="error" className="mt-4">No se pudieron consultar las solicitudes.</Alert> : null}
        {!jobsError && !jobs?.length ? <p className="mt-4 text-sm text-muted-foreground">No hay eliminaciones pendientes.</p> : null}
        <ul className="mt-4 grid gap-3">
          {(jobs ?? []).map(job => <li key={job.id} className="min-w-0 rounded-lg border border-border p-4">
            <p className="break-all text-sm font-medium">Solicitud {job.id}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {job.last_error_code === "storage_review_required" ? "Revisión de archivos: identifica las referencias de la escuela y conserva su propiedad antes de reintentar." : job.status === "retry" ? "El proveedor o una dependencia no ha confirmado la operación. La solicitud se conserva para reintentar." : "Trabajo en curso; los cursos y derechos de terceros se conservan."}
            </p>
            <form action={retryDeletionJobAction} className="mt-3">
              <input type="hidden" name="jobId" value={job.id} />
              <SubmitButton pendingLabel="Comprobando…">Comprobar y reintentar</SubmitButton>
            </form>
          </li>)}
        </ul>
      </section>
    </div>
  );
}
