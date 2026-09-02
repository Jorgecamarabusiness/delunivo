"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createStripeCheckoutAction } from "./actions";
import Link from "next/link";

export function BuyCourseButton({ courseId }: { courseId: string }) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [acceptedDigitalContent, setAcceptedDigitalContent] = useState(false);

  async function handleStripeCheckout() {
    setIsCheckingOut(true);
    setCheckoutError(null);

    const result = await createStripeCheckoutAction(
      courseId,
      acceptedDigitalContent
    );

    setIsCheckingOut(false);
    if (result?.error) {
      setCheckoutError(result.error);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
        <input
          type="checkbox"
          checked={acceptedDigitalContent}
          onChange={(event) => setAcceptedDigitalContent(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <span>
          Solicito acceso inmediato al contenido digital y reconozco que, una
          vez iniciado, puedo perder el derecho de desistimiento. He leído las{" "}
          <Link href="/condiciones" className="font-medium text-foreground underline">
            condiciones
          </Link>
          .
        </span>
      </label>
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleStripeCheckout}
        disabled={isCheckingOut || !acceptedDigitalContent}
      >
        {isCheckingOut ? "Redirigiendo..." : "Comprar con tarjeta"}
      </Button>
      {checkoutError ? (
        <p className="text-xs font-medium text-muted-foreground">
          Error: {checkoutError}
        </p>
      ) : null}

    </div>
  );
}
