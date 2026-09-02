import Link from "next/link";
import type { Metadata } from "next";
import { buttonClassName } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "404 — Delunivo",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="contenido-principal"
      className="flex min-h-[70dvh] items-center justify-center px-6 py-20"
    >
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-content">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Esta página no existe
        </h1>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          Puede que el enlace haya cambiado o que la empresa indicada no esté
          disponible.
        </p>
        <Link
          href="/"
          className={buttonClassName("neutral", "md", "mt-8")}
        >
          Volver a Delunivo
        </Link>
      </div>
    </main>
  );
}
