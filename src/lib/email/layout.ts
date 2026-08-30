/**
 * Plantilla HTML común de todos los emails de Delunivo. Estilos en línea a
 * propósito: los clientes de correo ignoran las hojas de estilo externas y
 * buena parte del CSS moderno.
 */

import { PLATFORM_NAME } from "@/lib/brand";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailContent = {
  heading: string;
  /** Párrafos de texto plano; se escapan antes de insertarlos. */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Código de verificación, si el email lleva uno. */
  code?: string;
  footer?: string;
};

export function renderEmail(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(text)}</p>`
    )
    .join("");

  const code = content.code
    ? `<div style="margin:0 0 24px;padding:20px;background:#f4f4f5;border-radius:12px;text-align:center;">
         <div style="font-size:34px;font-weight:700;letter-spacing:10px;color:#0a0a0a;font-family:monospace;">${escapeHtml(content.code)}</div>
       </div>`
    : "";

  const action = content.action
    ? `<p style="margin:0 0 24px;">
         <a href="${escapeHtml(content.action.url)}" style="display:inline-block;background:#0a0a0a;color:#ffffff;padding:13px 26px;border-radius:999px;text-decoration:none;font-size:15px;font-weight:600;">${escapeHtml(content.action.label)}</a>
       </p>`
    : "";

  const footer = content.footer
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;">${escapeHtml(content.footer)}</p>`
    : "";

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;padding:32px;">
      <div style="margin:0 0 24px;font-size:15px;font-weight:700;color:#16a34a;">${PLATFORM_NAME}</div>
      <h1 style="margin:0 0 20px;font-size:21px;line-height:1.3;color:#0a0a0a;">${escapeHtml(content.heading)}</h1>
      ${paragraphs}
      ${code}
      ${action}
      ${footer}
    </div>
  </body>
</html>`;
}

/**
 * Aviso que se antepone al cuerpo cuando el email va redirigido a un correo de
 * pruebas en vez de a su destinatario real — para no confundir un email de
 * prueba con uno de verdad al revisar la bandeja.
 */
export function renderRedirectNotice(originalRecipient: string): string {
  return `<div style="max-width:480px;margin:0 auto 12px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#92400e;">
    <strong>Email de pruebas.</strong> El destinatario real era
    <strong>${escapeHtml(originalRecipient)}</strong>; se te ha redirigido a ti porque
    el envío real está desactivado.
  </div>`;
}
