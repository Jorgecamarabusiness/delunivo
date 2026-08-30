export type DeliveryMode = "live" | "off" | "redirect";

export function resolveDeliveryMode(
  configuredMode: string | undefined,
  vercelEnvironment: string | undefined,
  hasConfiguredSender = false
): DeliveryMode {
  if (configuredMode === "off") return "off";
  if (vercelEnvironment === "production" && hasConfiguredSender) return "live";
  if (configuredMode === "live") return "live";
  return "redirect";
}

export function getEmailDeliveryMode(): DeliveryMode {
  return resolveDeliveryMode(
    process.env.EMAIL_DELIVERY_MODE,
    process.env.VERCEL_ENV,
    Boolean(process.env.RESEND_FROM_EMAIL?.trim())
  );
}
