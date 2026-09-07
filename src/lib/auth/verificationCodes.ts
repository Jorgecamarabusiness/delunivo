import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeVerificationCodeWithRpc,
  issueVerificationCodeWithRpc,
  type VerificationCodeRpcClient,
  type VerificationPurpose,
} from "./verificationCodeRpc";

export type { VerificationPurpose } from "./verificationCodeRpc";

/** La caducidad la aplica la RPC en la base de datos (30 minutos). */
export const CODE_TTL_MINUTES = 30;

function verificationRpcClient(): VerificationCodeRpcClient {
  const admin = createAdminClient();
  return {
    async rpc(name, params) {
      const { data, error } = await admin.rpc(name, params);
      return { data, error };
    },
  };
}

export async function issueVerificationCode(
  email: string,
  purpose: VerificationPurpose
): Promise<{ code: string; error: string | null }> {
  return issueVerificationCodeWithRpc(
    verificationRpcClient(),
    email,
    purpose
  );
}

export async function consumeVerificationCode(
  email: string,
  purpose: VerificationPurpose,
  code: string
): Promise<{ error: string | null }> {
  return consumeVerificationCodeWithRpc(
    verificationRpcClient(),
    email,
    purpose,
    code
  );
}

/** Revoca códigos emitidos durante un alta que después tuvo que deshacerse. */
export async function revokeVerificationCodes(email: string, purpose: VerificationPurpose): Promise<void> {
  const admin = createAdminClient();
  await admin.from("verification_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", email.trim().toLowerCase())
    .eq("purpose", purpose).is("consumed_at", null);
}
