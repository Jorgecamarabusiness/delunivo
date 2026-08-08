"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function InviteForm({
  action,
  placeholder,
  submitLabel,
}: {
  action: (email: string) => Promise<{ error: string | null }>;
  placeholder: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await action(email);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEmail("");
    setSent(true);
    router.refresh();
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-start gap-3">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={placeholder}
        required
        className="min-w-[220px] flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Enviando..." : submitLabel}
      </Button>
      {error && (
        <p className="w-full text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="w-full text-xs font-medium text-muted-foreground">
          Invitación enviada.
        </p>
      )}
    </form>
  );
}
