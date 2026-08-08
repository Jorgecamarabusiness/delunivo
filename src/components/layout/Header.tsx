import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";
import { isAnyOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";

export async function Header() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    organization,
    homeHref,
    loginHref,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentOrganization(),
    orgPath("/"),
    orgPath("/login"),
  ]);

  let name: string | null = null;
  let isAdmin = false;

  if (user) {
    const [{ data: profile }, adminCheck] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).single(),
      isAnyOrgAdmin(supabase, user.id),
    ]);

    name = profile?.name ?? null;
    isAdmin = adminCheck;
  }

  const brandName = organization?.name ?? "Aularia";

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href={isAdmin ? "/admin" : homeHref}
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          {organization?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : null}
          {brandName}
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium sm:inline">
              {name ?? user.email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        ) : (
          <Link
            href={loginHref}
            className="rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
          >
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  );
}
