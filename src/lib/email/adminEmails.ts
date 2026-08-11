import { createAdminClient } from "@/lib/supabase/admin";

export type AdminEmail = {
  id: string;
  email: string;
  label: string | null;
  isActive: boolean;
};

/**
 * Los correos de la lista `admin_emails` marcados como activos. Cuando el envío
 * real está desactivado (ver `isLiveDelivery` en ./send.ts), TODO email de la
 * aplicación se redirige a estas direcciones en vez de al destinatario real —
 * así se pueden probar registros, invitaciones y recuperaciones de contraseña
 * sin crear buzones de verdad ni depender de que Resend tenga un dominio
 * verificado.
 *
 * Se lee con la service role key a propósito: quien manda un email casi nunca
 * es el super admin (es un alumno registrándose), y la RLS de `admin_emails`
 * solo deja leerla al super admin.
 */
export async function getActiveAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("admin_emails")
    .select("email")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => row.email);
}

/** Lista completa para la pantalla de gestión del super admin. */
export async function listAdminEmails(): Promise<AdminEmail[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("admin_emails")
    .select("id, email, label, is_active")
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    label: row.label,
    isActive: row.is_active,
  }));
}
