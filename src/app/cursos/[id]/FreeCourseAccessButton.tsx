"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { grantFreeCourseAccessAction } from "./actions";

export function FreeCourseAccessButton({
  courseId,
  aprenderHref,
}: {
  courseId: string;
  aprenderHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function grantAccess() {
    setError(null);
    startTransition(async () => {
      const result = await grantFreeCourseAccessAction(courseId);
      if (result.granted) {
        router.push(aprenderHref);
        return;
      }
      setError(result.error ?? "No se pudo activar el acceso gratuito.");
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        onClick={grantAccess}
        disabled={pending}
      >
        {pending ? "Activando acceso..." : "Accede gratis"}
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
