import { resend } from "./client";

export async function sendLicenseKeyEmail(params: {
  to: string;
  courseTitle: string;
  licenseKey: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const from = `Aularia <${fromAddress}>`;

  await resend.emails.send({
    from,
    to: params.to,
    subject: `Tu código de acceso a ${params.courseTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>¡Gracias por tu compra!</h2>
        <p>Ya tienes acceso a <strong>${params.courseTitle}</strong>. Usa este código para desbloquear el curso en la web:</p>
        <p style="font-size: 20px; font-weight: bold; letter-spacing: 1px; background: #f4f4f4; padding: 12px 16px; border-radius: 8px; text-align: center;">
          ${params.licenseKey}
        </p>
        <p>Pasos:</p>
        <ol>
          <li>Entra en <a href="${siteUrl}">${siteUrl}</a> e inicia sesión (o crea una cuenta).</li>
          <li>Ve a la página del curso y pulsa "¿Ya pagaste en Whop?".</li>
          <li>Pega el código de arriba y valida.</li>
        </ol>
      </div>
    `,
  });
}
