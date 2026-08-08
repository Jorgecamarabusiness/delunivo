import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <div className="mx-auto flex flex-1 items-center px-6 py-24">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Footer />
    </div>
  );
}

export default async function CursosPage() {
  const organization = await getCurrentOrganization();

  if (!organization) {
    return <EmptyState message="No hay cursos disponibles." />;
  }

  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, price")
    .eq("organization_id", organization.id)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (!courses || courses.length === 0) {
    return <EmptyState message="Todavía no hay cursos publicados." />;
  }

  if (courses.length === 1) {
    redirect(await orgPath(`/cursos/${courses[0].id}`));
  }

  const cursosPrefix = await orgPath("/cursos");

  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`${cursosPrefix}/${course.id}`}
                className="rounded-lg border border-border p-6 transition-colors hover:bg-muted"
              >
                <h2 className="text-lg font-semibold leading-snug">
                  {course.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  ${course.price}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
