import Link from "next/link";
import { redirect } from "next/navigation";
import { CourseThumbnail } from "@/components/courses/CourseCard";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AccessSource = "purchase" | "invite";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/perfil");

  const [{ data: profile }, { data: purchases }, { data: invitedAccess }, { data: memberships }] =
    await Promise.all([
      supabase.from("profiles").select("name, email").eq("id", user.id).maybeSingle(),
      supabase.from("purchases").select("course_id").eq("user_id", user.id),
      supabase
        .from("student_course_access")
        .select("course_id")
        .eq("user_id", user.id),
      supabase
        .from("organization_students")
        .select("organization_id, status")
        .eq("user_id", user.id),
    ]);

  const sourceByCourse = new Map<string, Set<AccessSource>>();
  for (const purchase of purchases ?? []) {
    sourceByCourse.set(
      purchase.course_id,
      new Set([...(sourceByCourse.get(purchase.course_id) ?? []), "purchase"])
    );
  }
  for (const access of invitedAccess ?? []) {
    sourceByCourse.set(
      access.course_id,
      new Set([...(sourceByCourse.get(access.course_id) ?? []), "invite"])
    );
  }

  const courseIds = [...sourceByCourse.keys()];
  const admin = createAdminClient();
  const { data: courses } = courseIds.length
    ? await admin
        .from("courses")
        .select("id, title, status, thumbnail_url, organization_id")
        .in("id", courseIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const organizationIds = [
    ...new Set((courses ?? []).map((course) => course.organization_id)),
  ];
  const { data: organizations } = organizationIds.length
    ? await admin
        .from("organizations")
        .select("id, name, slug")
        .in("id", organizationIds)
    : { data: [] };

  const organizationById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization])
  );
  const membershipByOrganization = new Map(
    (memberships ?? []).map((membership) => [
      membership.organization_id,
      membership.status,
    ])
  );

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Container width="md" className="py-10 sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight">Mi perfil</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile?.name ?? "Tu cuenta"} · {profile?.email ?? user.email}
          </p>

          <section className="mt-10" aria-labelledby="my-courses-title">
            <h2 id="my-courses-title" className="text-xl font-semibold">
              Mis cursos
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Aquí aparecen juntos tus cursos comprados e invitados, aunque sean
              de empresas diferentes.
            </p>

            {!courses?.length ? (
              <div className="mt-6 rounded-lg border border-border p-6">
                <p className="text-sm text-muted-foreground">
                  Todavía no tienes ningún curso.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {courses.map((course) => {
                  const organization = organizationById.get(course.organization_id);
                  const sources = sourceByCourse.get(course.id) ?? new Set<AccessSource>();
                  const membershipActive =
                    membershipByOrganization.get(course.organization_id) === "active";
                  const canOpen =
                    Boolean(organization) &&
                    membershipActive &&
                    course.status === "published";

                  return (
                    <article
                      key={course.id}
                      className="overflow-hidden rounded-lg border border-border bg-background"
                    >
                      <CourseThumbnail
                        title={course.title}
                        thumbnailUrl={course.thumbnail_url}
                        className="aspect-video"
                      />
                      <div className="p-5">
                        <div className="flex flex-wrap gap-2">
                          {sources.has("purchase") ? (
                            <Badge variant="solid">Comprado</Badge>
                          ) : null}
                          {sources.has("invite") ? (
                            <Badge variant="outline">Invitado</Badge>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{course.title}</h3>
                        {organization ? (
                          <Link
                            href={`/o/${organization.slug}`}
                            className="mt-1 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {organization.name}
                          </Link>
                        ) : null}

                        {canOpen && organization ? (
                          <Link
                            href={`/o/${organization.slug}/cursos/${course.id}/aprender`}
                            className={buttonClassName("primary", "sm", "mt-5 w-full")}
                          >
                            Continuar curso
                          </Link>
                        ) : (
                          <p className="mt-5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            {membershipActive
                              ? "Este curso no está publicado ahora mismo."
                              : "Tu acceso a esta empresa está desactivado. Contacta con su administrador."}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
