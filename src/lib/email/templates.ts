import { sendEmail, type SendEmailResult } from "./send";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Código de un solo uso para confirmar el correo al registrarse. */
export function sendSignupCodeEmail(params: {
  to: string;
  code: string;
  minutes: number;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: params.to,
    subject: "Tu código para confirmar la cuenta",
    content: {
      heading: "Confirma tu correo",
      paragraphs: [
        "Introduce este código para terminar de crear tu cuenta:",
      ],
      code: params.code,
      footer:
        `El código caduca en ${params.minutes} minutos. ` +
        "Si no has sido tú, puedes ignorar este correo.",
    },
  });
}

/** Código de un solo uso para elegir una contraseña nueva. */
export function sendPasswordResetCodeEmail(params: {
  to: string;
  code: string;
  minutes: number;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: params.to,
    subject: "Tu código para cambiar la contraseña",
    content: {
      heading: "Cambia tu contraseña",
      paragraphs: [
        "Has pedido cambiar tu contraseña. Introduce este código para elegir una nueva:",
      ],
      code: params.code,
      footer:
        `El código caduca en ${params.minutes} minutos. ` +
        "Si no has pedido tú este cambio, ignora este correo: tu contraseña no cambiará.",
    },
  });
}

/**
 * Invitación de alumno o de co-admin. El enlace va SIN el prefijo /o/<slug> a
 * propósito: la invitación resuelve su organización por el token guardado en la
 * base de datos, no por la URL.
 */
export function sendInvitationEmail(params: {
  to: string;
  organizationName: string;
  inviteType: "student" | "admin";
  token: string;
}): Promise<SendEmailResult> {
  const roleLabel = params.inviteType === "admin" ? "administrador" : "alumno";

  return sendEmail({
    to: params.to,
    subject: `Te han invitado a ${params.organizationName}`,
    content: {
      heading: `Te han invitado a ${params.organizationName}`,
      paragraphs: [`Te han invitado como ${roleLabel}. Acepta la invitación para entrar:`],
      action: {
        label: "Aceptar invitación",
        url: `${siteUrl()}/invitaciones/${params.token}`,
      },
      footer: "Si no esperabas este correo, puedes ignorarlo.",
    },
  });
}

/** Aviso de cortesía con la license key comprada en Whop. */
export function sendLicenseKeyEmail(params: {
  to: string;
  courseTitle: string;
  licenseKey: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: params.to,
    subject: `Tu código de acceso a ${params.courseTitle}`,
    content: {
      heading: `Tu código de acceso a ${params.courseTitle}`,
      paragraphs: [
        "Gracias por tu compra. Este es tu código de acceso:",
        params.licenseKey,
        "Introdúcelo en la página del curso para desbloquear el contenido.",
      ],
      action: { label: "Ir al curso", url: siteUrl() },
    },
  });
}
