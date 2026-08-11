import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";
import { isAnyOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";
import {
  getPublishedCourses,
  shouldShowCoursesNav,
} from "@/lib/courses/publicCourses";

export async function Header() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    organization,
    homeHref,
    loginHref,
    coursesHref,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getCurrentOrganization(),
    orgPath("/"),
    orgPath("/login"),
    orgPath("/cursos"),
  ]);

  let name: string | null = null;
  let isAdmin = false;

  if (user) {
    const [{ data: profile }, adminCheck] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
      isAnyOrgAdmin(supabase, user.id),
    ]);

    name = profile?.name ?? null;
    isAdmin = adminCheck;
  }

  // El enlace "Cursos" solo aparece si la landing de la empresa NO llega a
  // enseñarlos todos (más de LANDING_COURSE_LIMIT). Con 1 o 4 cursos sería un
  // botón que lleva a lo mismo que ya se está viendo.
  let showCoursesNav = false;
  if (organization) {
    const courses = await getPublishedCourses(organization.id);
    showCoursesNav = shouldShowCoursesNav(courses.length);
  }

  const brandName = organization?.name ?? "Aularia";

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link
          href={isAdmin ? "/admin" : homeHref}
          className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight sm:text-xl"
        >
          {organization?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className="truncate">{brandName}</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
          {showCoursesNav && (
            <Link
              href={coursesHref}
              className="text-sm font-medium hover:underline"
            >
              Cursos
            </Link>
          )}

          {user ? (
            <>
              <span className="hidden max-w-[16ch] truncate text-sm font-medium sm:inline">
                {name ?? user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background sm:px-5"
                >
                  Salir
                </button>
              </form>
            </>
          ) : (
            <Link
              href={loginHref}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background sm:px-5"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
