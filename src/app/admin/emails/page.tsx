import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import { listAdminEmails } from "@/lib/email/adminEmails";
import { Alert } from "@/components/ui/Alert";
import { AddAdminEmailForm } from "./AddAdminEmailForm";
import { AdminEmailRow } from "./AdminEmailRow";
import { PLATFORM_NAME } from "@/lib/brand";

export default async function AdminEmailsPage() {
  const supabase = await createClient();
  const { error } = await requireSuperAdmin(supabase);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Correos de prueba</h1>
        <Alert variant="error" className="mt-8">
          {error}
        </Alert>
      </div>
    );
  }

  const entries = await listAdminEmails();
  const isLive = process.env.EMAIL_DELIVERY_MODE === "live";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Correos de prueba</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Mientras el envío real esté desactivado, <strong>todos</strong> los
        correos de {PLATFORM_NAME} (verificación, recuperación de contraseña,
        invitaciones, licencias) se envían a las direcciones activas de esta
        lista en vez de a su destinatario real. El destinatario original aparece
        en el asunto.
      </p>

      <Alert variant={isLive ? "warning" : "info"} className="mt-6">
        {isLive ? (
          <>
            <strong>Envío real activado</strong> (EMAIL_DELIVERY_MODE=live). Los
            correos van a sus destinatarios de verdad y esta lista se ignora.
          </>
        ) : (
          <>
            <strong>Envío real desactivado.</strong> Todo se redirige aquí. Para
            enviar de verdad hace falta un dominio verificado en Resend y poner{" "}
            <code>EMAIL_DELIVERY_MODE=live</code>.
          </>
        )}
      </Alert>

      <AddAdminEmailForm />

      <table className="mt-8 w-full text-left text-sm">
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

      {entries.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No hay ningún correo en la lista. Añade al menos uno activo o los
          emails no se podrán enviar.
        </p>
      )}
    </div>
  );
}
