"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createStripeCheckoutAction } from "./actions";

export function BuyCourseButton({ courseId }: { courseId: string }) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleStripeCheckout() {
    setIsCheckingOut(true);
    setCheckoutError(null);

    const result = await createStripeCheckoutAction(courseId);

    setIsCheckingOut(false);
    if (result?.error) {
      setCheckoutError(result.error);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleStripeCheckout}
        disabled={isCheckingOut}
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
