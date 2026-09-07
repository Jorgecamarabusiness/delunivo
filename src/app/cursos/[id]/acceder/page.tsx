import { redirect } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getCurrentOrganization } from "@/lib/organizations/getCurrentOrganization";
import { orgPath } from "@/lib/organizations/orgPath";
import { isFreeCoursePrice } from "@/lib/courses/freeCourseAccess";
import { createClient } from "@/lib/supabase/server";
import { FreeCourseAccessOnReturn } from "../FreeCourseAccessOnReturn";

export default async function FreeCourseReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: course }, organization] = await Promise.all([
    supabase
      .from("courses")
      .select("id, price, organization_id")
      .eq("id", id)
      .maybeSingle(),
    getCurrentOrganization(),
  ]);

  const courseHref = await orgPath(`/cursos/${id}`);
  if (!course || !organization || course.organization_id !== organization.id || !isFreeCoursePrice(course.price)) {
    redirect(courseHref);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const accessHref = await orgPath(`/cursos/${id}/acceder`);
  if (!user) {
    const loginHref = await orgPath("/login");
    redirect(`${loginHref}?next=${encodeURIComponent(accessHref)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="flex flex-1 items-center">
        <FreeCourseAccessOnReturn
          courseId={course.id}
          aprenderHref={await orgPath(`/cursos/${course.id}/aprender`)}
        />
      </main>
      <Footer />
    </div>
  );
}
