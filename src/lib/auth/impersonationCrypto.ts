import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const AAD = Buffer.from("delunivo-support-impersonation:v1", "utf8");

export type StoredActorSession = {
  accessToken: string;
  refreshToken: string;
};

function encryptionKey() {
  const configured = process.env.IMPERSONATION_SESSION_KEY?.trim();
  if (!configured) {
    throw new Error("Falta IMPERSONATION_SESSION_KEY para usar Run as.");
  }
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) {
    throw new Error("IMPERSONATION_SESSION_KEY debe contener 32 bytes en base64.");
  }
  return key;
}

export function hashImpersonationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createImpersonationExitProof(
  auditSessionId: string,
  authSessionId: string
) {
  return createHmac("sha256", encryptionKey())
    .update(`delunivo-run-as-exit:v1:${auditSessionId}:${authSessionId}`)
    .digest("base64url");
}

export function verifyImpersonationExitProof(
  proof: string,
  auditSessionId: string,
  authSessionId: string
) {
  const expected = Buffer.from(
    createImpersonationExitProof(auditSessionId, authSessionId),
    "utf8"
  );
  const received = Buffer.from(proof, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function encryptActorSession(session: StoredActorSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptActorSession(value: string): StoredActorSession {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("La sesión original de Run as no tiene un formato válido.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<StoredActorSession>;
  if (!parsed.accessToken || !parsed.refreshToken) {
    throw new Error("La sesión original de Run as está incompleta.");
  }
  return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
}

export function getAuthSessionId(accessToken: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as { session_id?: unknown };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}
