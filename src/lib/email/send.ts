import { Resend } from "resend";
import { getActiveAdminEmails } from "./adminEmails";
import { renderEmail, renderRedirectNotice, type EmailContent } from "./layout";
import { PLATFORM_NAME } from "@/lib/brand";
import { getEmailDeliveryMode } from "./deliveryMode";

export type SendEmailResult = { error: string | null };

/**
 * EMAIL_DELIVERY_MODE:
 *
 * - `live`  → los emails van a su destinatario real. Requiere un dominio
 *             verificado en resend.com/domains y RESEND_FROM_EMAIL de ese
 *             dominio; sin eso Resend responde 403 a cualquier destinatario
 *             que no sea el titular de la cuenta.
 * - `off`   → no se envía nada. Para los tests E2E y CI, que si no llenarían
 *             de correos de prueba la bandeja de los admin_emails en cada
 *             corrida. Se registra en consola y se devuelve éxito.
 * - en desarrollo, resto / sin poner → se redirigen a `admin_emails`.
 * - en la producción de Delunivo → se entregan al destinatario real cuando
 *   existe RESEND_FROM_EMAIL; hasta entonces mantienen la redirección segura.
 *   `off` sigue disponible como interruptor de emergencia.
 *
 * El valor por defecto (redirigido) es DELIBERADAMENTE el seguro: es el único
 * que funciona hoy sin dominio verificado.
 */
function fromAddress(address: string | undefined): string {
  // onboarding@resend.dev es el remitente que Resend permite sin dominio
  // propio verificado (solo entrega al correo del titular de la cuenta).
  return `${PLATFORM_NAME} <${address ?? "onboarding@resend.dev"}>`;
}

export type SendEmailParams = {
  to: string;
  subject: string;
  content: EmailContent;
};

/**
 * Punto ÚNICO de envío de email de toda la aplicación. Nada llama a Resend
 * directamente: así la redirección a correos de prueba, el remitente y el
 * manejo de errores viven en un solo sitio.
 *
 * Nunca lanza: devuelve `{ error }`. Un fallo de email no debe tumbar el
 * registro de un alumno ni dejar una invitación a medias.
 */
export async function sendEmail({
  to,
  subject,
  content,
}: SendEmailParams): Promise<SendEmailResult> {
  const mode = getEmailDeliveryMode();

  if (mode === "off") {
    console.info(`[email:off] "${subject}" -> ${to} (no enviado)`);
    return { error: null };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Falta configurar RESEND_API_KEY en el servidor." };
  }

  const configuredFromAddress = process.env.RESEND_FROM_EMAIL?.trim();
  if (mode === "live" && !configuredFromAddress) {
    return {
      error:
        "Falta configurar RESEND_FROM_EMAIL con un dominio verificado en Resend.",
    };
  }

  let recipients: string[] = [to];
  let finalSubject = subject;
  let html = renderEmail(content);

  if (mode === "redirect") {
    const testRecipients = await getActiveAdminEmails();

    if (testRecipients.length === 0) {
      return {
        error:
          "El envío real de emails está desactivado y no hay ningún correo de " +
          "pruebas activo. Añade uno en /admin/emails o activa " +
          "EMAIL_DELIVERY_MODE=live.",
      };
    }

    recipients = testRecipients;
    // El destinatario original va en el asunto para poder seguir el hilo de una
    // prueba con varios usuarios distintos en la misma bandeja.
    finalSubject = `[→ ${to}] ${subject}`;
    html = renderRedirectNotice(to) + html;
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: fromAddress(configuredFromAddress),
      to: recipients,
      subject: finalSubject,
      html,
    });

    if (error) {
      return { error: describeResendError(error.message ?? String(error)) };
    }

    return { error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: describeResendError(message) };
  }
}

function describeResendError(raw: string): string {
  if (/verify a domain|only send testing emails/i.test(raw)) {
    return (
      "Resend necesita un dominio verificado y RESEND_FROM_EMAIL para enviar " +
      "correos a destinatarios reales."
    );
  }

  if (/rate limit/i.test(raw)) {
    return "Se ha alcanzado el límite de envío de Resend. Prueba en unos minutos.";
  }

  if (/api key|unauthorized/i.test(raw)) {
    return "La clave de Resend no es válida. Revisa RESEND_API_KEY.";
  }

  return `No se pudo enviar el correo: ${raw}`;
}
