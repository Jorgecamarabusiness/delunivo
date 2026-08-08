import crypto from "node:crypto";

/** El token en claro solo vive en el email/URL; en la BD solo se guarda su hash. */
export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
