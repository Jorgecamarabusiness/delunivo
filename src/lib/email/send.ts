import { Resend } from "resend";
import { getActiveAdminEmails } from "./adminEmails";
import { renderEmail, renderRedirectNotice, type EmailContent } from "./layout";
import { PLATFORM_NAME } from "@/lib/brand";

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
 * - resto / sin poner → se redirigen a los correos activos de `admin_emails`.
 *
 * El valor por defecto (redirigido) es DELIBERADAMENTE el seguro: es el único
 * que funciona hoy sin dominio verificado.
 */
type DeliveryMode = "live" | "off" | "redirect";

function deliveryMode(): DeliveryMode {
  const raw = process.env.EMAIL_DELIVERY_MODE;
  if (raw === "live") return "live";
  if (raw === "off") return "off";
  return "redirect";
}

function fromAddress(): string {
  // onboarding@resend.dev es el remitente que Resend permite sin dominio
  // propio verificado (solo entrega al correo del titular de la cuenta).
  const address = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  return `${PLATFORM_NAME} <${address}>`;
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
  const mode = deliveryMode();

  if (mode === "off") {
    console.info(`[email:off] "${subject}" -> ${to} (no enviado)`);
    return { error: null };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { error: "Falta configurar RESEND_API_KEY en el servidor." };
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
      from: fromAddress(),
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
      "Resend solo puede escribir al correo del titular de la cuenta mientras " +
      "no haya un dominio verificado en resend.com/domains. Deja " +
      "EMAIL_DELIVERY_MODE sin poner a 'live' para que los emails se redirijan " +
      "a los correos de prueba."
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
