import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { PLATFORM_NAME } from "@/lib/brand";
import Link from "next/link";

export async function Footer() {
  const organization = await getCurrentOrganization();
  const name = organization?.name ?? PLATFORM_NAME;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground">
        <span>
          © {year} {name}. Todos los derechos reservados.
        </span>
        {organization ? (
          <span className="text-xs">Creado con {PLATFORM_NAME}</span>
        ) : null}
        <nav aria-label="Información legal" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs">
          <Link href="/aviso-legal" className="underline-offset-4 hover:underline">
            Aviso legal
          </Link>
          <Link href="/privacidad" className="underline-offset-4 hover:underline">
            Privacidad
          </Link>
          <Link href="/condiciones" className="underline-offset-4 hover:underline">
            Condiciones
          </Link>
        </nav>
      </div>
    </footer>
  );
}
