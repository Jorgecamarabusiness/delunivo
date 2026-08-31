"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ensureReferralCodeAction } from "./actions";

export function AffiliatePanel({
  organizationId,
  referralUrl,
  activeReferrals,
  pendingReferrals,
  effectiveDiscountPercent,
  discountCapPercent,
}: {
  organizationId: string;
  referralUrl: string | null;
  activeReferrals: number;
  pendingReferrals: number;
  effectiveDiscountPercent: number;
  discountCapPercent: number;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function createLink() {
    setError(null);
    startTransition(async () => {
      const result = await ensureReferralCodeAction(organizationId);
      if (result.error) setError(result.error);
      else window.location.reload();
    });
  }

  async function copyLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setMessage("Enlace copiado.");
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-muted/25 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invita y ahorra</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Cada empresa invitada que esté pagando reduce tu cuota un 10%. El
            descuento normal no supera el {discountCapPercent}%.
          </p>
        </div>
        <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold">
          Descuento actual: {effectiveDiscountPercent}%
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-2xl font-bold">{activeReferrals}</p>
          <p className="text-sm text-muted-foreground">Referidos pagando</p>
        </div>
        <div className="rounded-md border border-border bg-background p-4">
          <p className="text-2xl font-bold">{pendingReferrals}</p>
          <p className="text-sm text-muted-foreground">Pendientes de primer pago</p>
        </div>
      </div>

      {referralUrl ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={referralUrl}
            aria-label="Tu enlace de invitación"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
          />
          <Button type="button" onClick={copyLink}>
            Copiar enlace
          </Button>
        </div>
      ) : (
        <Button type="button" className="mt-5" onClick={createLink} disabled={pending}>
          {pending ? "Creando enlace…" : "Crear mi enlace"}
        </Button>
      )}

      {message ? <Alert variant="success" className="mt-4">{message}</Alert> : null}
      {error ? <Alert variant="error" className="mt-4">{error}</Alert> : null}
    </section>
  );
}
