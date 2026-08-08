import { resend } from "./client";

export async function sendInvitationEmail(params: {
  to: string;
  organizationName: string;
  inviteType: "student" | "admin";
  token: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const from = `Aularia <${fromAddress}>`;
  const acceptUrl = `${siteUrl}/invitaciones/${params.token}`;
  const roleLabel = params.inviteType === "admin" ? "administrador" : "alumno";

  await resend.emails.send({
    from,
    to: params.to,
    subject: `Te han invitado a ${params.organizationName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Te han invitado a ${params.organizationName}</h2>
        <p>Te han invitado como <strong>${roleLabel}</strong>. Abre este enlace para aceptar la invitación:</p>
        <p>
          <a href="${acceptUrl}" style="display:inline-block; background:#111; color:#fff; padding:12px 20px; border-radius:24px; text-decoration:none;">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#888; font-size:12px;">Si no esperabas este correo, puedes ignorarlo.</p>
      </div>
    `,
  });
}
