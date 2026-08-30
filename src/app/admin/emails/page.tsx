import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/requireOrgAdmin";
import { listAdminEmails } from "@/lib/email/adminEmails";
import { Alert } from "@/components/ui/Alert";
import { AddAdminEmailForm } from "./AddAdminEmailForm";
import { AdminEmailRow } from "./AdminEmailRow";
import { PLATFORM_NAME } from "@/lib/brand";
import { getEmailDeliveryMode } from "@/lib/email/deliveryMode";

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
  const isLive = getEmailDeliveryMode() === "live";
  const isProduction = process.env.VERCEL_ENV === "production";

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Correos de prueba</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Solo durante el desarrollo, <strong>todos</strong> los
        correos de {PLATFORM_NAME} (verificación, recuperación de contraseña,
        invitaciones) se envían a las direcciones activas de esta
        lista en vez de a su destinatario real. El destinatario original aparece
        en el asunto.
      </p>

      <Alert
        variant={isLive ? "warning" : isProduction ? "error" : "info"}
        className="mt-6"
      >
        {isLive ? (
          <>
            <strong>Envío real activado.</strong> En la producción de Delunivo los
            correos van a sus destinatarios y esta lista se ignora.
          </>
        ) : isProduction ? (
          <>
            <strong>Falta el remitente de producción.</strong> Hasta configurar
            RESEND_FROM_EMAIL con un dominio verificado, los correos siguen
            redirigiéndose a esta lista para no perderlos.
          </>
        ) : (
          <>
            <strong>Modo de desarrollo.</strong> Todo se redirige aquí para no
            escribir a destinatarios reales durante las pruebas.
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
