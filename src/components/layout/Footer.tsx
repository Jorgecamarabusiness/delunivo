import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { PLATFORM_NAME } from "@/lib/brand";

export async function Footer() {
  const organization = await getCurrentOrganization();
  const name = organization?.name ?? PLATFORM_NAME;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 px-6 py-10 text-sm text-muted-foreground">
        <span>
          © {year} {name}. Todos los derechos reservados.
        </span>
        {organization ? (
          <span className="text-xs">Creado con {PLATFORM_NAME}</span>
        ) : null}
      </div>
    </footer>
  );
}
