import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInvitationToken } from "@/lib/invitations/token";
import { AcceptInvitationForm } from "./AcceptInvitationForm";

function InvitationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background text-foreground">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

function InvalidInvitation({
  message,
  ctaHref = "/login",
  ctaLabel = "Ir a iniciar sesión",
}: {
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <InvitationLayout>
      <div className="text-center">
        <p className="text-sm font-semibold">Invitación no válida</p>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link href={ctaHref} className="mt-6 inline-block text-sm font-medium underline">
          {ctaLabel}
        </Link>
      </div>
    </InvitationLayout>
  );
}

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashInvitationToken(token);

  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("invitations")
    .select("id, organization_id, email, invite_type, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at) < new Date()) {
    return (
      <InvalidInvitation message="Este enlace ha caducado o ya no es válido. Pide que te inviten de nuevo." />
    );
  }

  const [{ data: organization }, { data: existingProfile }] = await Promise.all([
    admin.from("organizations").select("name").eq("id", invitation.organization_id).single(),
    admin.from("profiles").select("id").ilike("email", invitation.email).maybeSingle(),
  ]);

  const { data: invitationCourses } =
    invitation.invite_type === "student"
      ? await admin
          .from("invitation_courses")
          .select("course_id")
          .eq("invitation_id", invitation.id)
      : { data: [] as { course_id: string }[] };

  const courseIds = (invitationCourses ?? []).map((entry) => entry.course_id);
  const { data: invitedCourses } =
    courseIds.length > 0
      ? await admin.from("courses").select("id, title").in("id", courseIds)
      : { data: [] as { id: string; title: string }[] };

  const roleLabel = invitation.invite_type === "admin" ? "administrador" : "alumno";
  const organizationName = organization?.name ?? "esta organización";

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!existingProfile) {
    return (
      <InvitationLayout>
        <h1 className="text-center text-2xl font-bold tracking-tight">
          Te han invitado a {organizationName}
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Como {roleLabel}, con el correo <strong>{invitation.email}</strong>. Elige una
          contraseña para crear tu cuenta.
        </p>
        {invitedCourses && invitedCourses.length > 0 ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Cursos incluidos: {invitedCourses.map((course) => course.title).join(", ")}.
          </p>
        ) : null}
        <AcceptInvitationForm token={token} mode="create-account" />
      </InvitationLayout>
    );
  }

  if (currentUser && currentUser.email?.toLowerCase() === invitation.email.toLowerCase()) {
    return (
      <InvitationLayout>
        <h1 className="text-center text-2xl font-bold tracking-tight">
          Te han invitado a {organizationName}
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">Como {roleLabel}.</p>
        {invitedCourses && invitedCourses.length > 0 ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Cursos incluidos: {invitedCourses.map((course) => course.title).join(", ")}.
          </p>
        ) : null}
        <AcceptInvitationForm token={token} mode="confirm" />
      </InvitationLayout>
    );
  }

  if (currentUser) {
    return (
      <InvalidInvitation
        message={`Esta invitación es para ${invitation.email}, pero has iniciado sesión con otra cuenta. Cierra sesión e inicia con ese correo, o pide que te reenvíen la invitación a tu correo actual.`}
      />
    );
  }

  return (
    <InvalidInvitation
      message={`Ya existe una cuenta con ${invitation.email}. Inicia sesión para aceptar la invitación.`}
      ctaHref={`/login?next=${encodeURIComponent(`/invitaciones/${token}`)}`}
      ctaLabel="Iniciar sesión"
    />
  );
}
