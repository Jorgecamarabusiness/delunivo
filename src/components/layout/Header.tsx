import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth/actions";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { orgPath } from "@/lib/organizations/orgPath";
import {
  getPublishedCourses,
  shouldShowCoursesNav,
} from "@/lib/courses/publicCourses";
import { PLATFORM_NAME } from "@/lib/brand";
import {
  AdminIcon,
  CurriculumIcon,
  HomeIcon,
  LogOutIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { getActiveImpersonationForUser } from "@/lib/auth/impersonation";
import { stopRunAsAction } from "@/app/admin/plataforma/runAsActions";
import { BrandLogo } from "@/components/media/PublicImages";
import { PlatformLogo } from "@/components/media/PlatformLogo";

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
  let isSuperAdmin = false;
  let managedOrganizationHref: string | null = null;
  let impersonation: Awaited<ReturnType<typeof getActiveImpersonationForUser>> = null;

  if (user) {
    const [{ data: profile }, { data: superAdmin }, membership] = await Promise.all([
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
      supabase.rpc("is_super_admin"),
      getCurrentOrgMembership(supabase, user.id),
    ]);

    name = profile?.name ?? null;
    isSuperAdmin = Boolean(superAdmin);
    isAdmin = Boolean(membership) || isSuperAdmin;
    impersonation = await getActiveImpersonationForUser(user.id);

    if (membership) {
      const { data: managedOrganization } = await supabase
        .from("organizations")
        .select("slug")
        .eq("id", membership.organizationId)
        .maybeSingle();
      managedOrganizationHref = managedOrganization
        ? `/o/${managedOrganization.slug}`
        : null;
    }
  }

  // El enlace "Cursos" solo aparece si la landing de la empresa NO llega a
  // enseñarlos todos (más de LANDING_COURSE_LIMIT). Con 1 o 4 cursos sería un
  // botón que lleva a lo mismo que ya se está viendo.
  let showCoursesNav = false;
  if (organization) {
    const courses = await getPublishedCourses(organization.id);
    showCoursesNav = shouldShowCoursesNav(courses.length);
  }

  const brandName = organization?.name ?? PLATFORM_NAME;

  return (
    <div className="sticky top-0 z-50">
      {impersonation ? (
        <div className="flex min-h-11 items-center justify-between gap-3 bg-amber-300 px-3 text-xs font-semibold text-amber-950 sm:px-6 sm:text-sm">
          <p className="min-w-0 truncate">
            Run as: estás actuando como {impersonation.targetName} · termina antes de 15 min
          </p>
          <form action={stopRunAsAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:opacity-85"
            >
              Salir de Run as
            </button>
          </form>
        </div>
      ) : null}
      <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href={homeHref}
          className="flex min-h-11 min-w-0 items-center gap-2 text-base font-bold tracking-tight sm:text-xl"
        >
          {organization ? (
            <BrandLogo src={organization.logoUrl} name={brandName} />
          ) : (
            <PlatformLogo priority />
          )}
          <span className="truncate">{brandName}</span>
        </Link>

        <nav aria-label="Navegación principal" className="flex shrink-0 items-center gap-1 sm:gap-2">
          {showCoursesNav && (
            <Link
              href={coursesHref}
              aria-label="Cursos"
              title="Cursos"
              className="hidden h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-muted sm:inline-flex sm:w-auto sm:gap-2 sm:px-3"
            >
              <CurriculumIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Cursos</span>
            </Link>
          )}

          {user ? (
            <>
              {organization ? (
                <Link
                  href="/"
                  aria-label={`Ir a ${PLATFORM_NAME}`}
                  title={`Ir a ${PLATFORM_NAME}`}
                  className="hidden h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-muted sm:inline-flex sm:w-auto sm:gap-2 sm:px-3"
                >
                  <HomeIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">{PLATFORM_NAME}</span>
                </Link>
              ) : null}

              {managedOrganizationHref && managedOrganizationHref !== homeHref ? (
                <Link
                  href={managedOrganizationHref}
                  aria-label="Ver mi página"
                  title="Ver mi página"
                  className="hidden h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-muted sm:inline-flex sm:w-auto sm:gap-2 sm:px-3"
                >
                  <HomeIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Mi página</span>
                </Link>
              ) : null}

              {isAdmin ? (
                <Link
                  href="/admin"
                  aria-label="Administración"
                  title="Administración"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-muted sm:w-auto sm:gap-2 sm:px-3"
                >
                  <AdminIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Admin</span>
                </Link>
              ) : null}

              {isSuperAdmin ? (
                <Link
                  href="/admin/plataforma"
                  aria-label="Control Delunivo"
                  title="Control Delunivo"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-85 sm:w-auto sm:gap-2 sm:px-3"
                >
                  <AdminIcon className="h-4 w-4" />
                  <span className="hidden lg:inline">Control</span>
                </Link>
              ) : null}

              <Link
                href="/perfil"
                aria-label="Mi perfil y mis cursos"
                title="Mi perfil y mis cursos"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-muted sm:w-auto sm:gap-2 sm:px-3"
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden xl:inline">{name ?? "Mi perfil"}</span>
              </Link>

              <form action={signOutAction} className="hidden sm:block">
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-sm font-medium transition-colors hover:bg-foreground hover:text-background sm:w-auto sm:gap-2 sm:px-3"
                >
                  <LogOutIcon className="h-4 w-4" />
                  <span className="hidden xl:inline">Salir</span>
                </button>
              </form>

              <details className="group relative sm:hidden">
                <summary
                  aria-label="Más opciones"
                  title="Más opciones"
                  className="inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-border text-lg font-semibold tracking-widest transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
                >
                  <span aria-hidden="true">•••</span>
                </summary>
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 flex min-w-52 flex-col rounded-lg border border-border bg-background p-2 shadow-lg">
                  {showCoursesNav ? (
                    <Link
                      href={coursesHref}
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-muted"
                    >
                      <CurriculumIcon className="h-4 w-4" />
                      Cursos
                    </Link>
                  ) : null}
                  {organization ? (
                    <Link
                      href="/"
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-muted"
                    >
                      <HomeIcon className="h-4 w-4" />
                      Ir a {PLATFORM_NAME}
                    </Link>
                  ) : null}
                  {managedOrganizationHref && managedOrganizationHref !== homeHref ? (
                    <Link
                      href={managedOrganizationHref}
                      className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium hover:bg-muted"
                    >
                      <HomeIcon className="h-4 w-4" />
                      Ver mi página
                    </Link>
                  ) : null}
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium hover:bg-muted"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <Link
              href={loginHref}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background sm:px-5"
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </div>
      </header>
    </div>
  );
}
