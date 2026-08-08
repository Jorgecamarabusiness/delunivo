import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgMembership } from "@/lib/organizations/getCurrentOrgMembership";
import { inviteStudentAction, inviteAdminAction } from "./actions";
import { InviteForm } from "./InviteForm";
import { StudentActions } from "./StudentActions";
import { AdminActions } from "./AdminActions";
import { RevokeInvitationButton } from "./RevokeInvitationButton";

type ProfileInfo = { name: string; email: string };

export default async function UsuariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = user ? await getCurrentOrgMembership(supabase, user.id) : null;

  if (!membership) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no perteneces a ninguna organización.
        </p>
      </div>
    );
  }

  const [{ data: students }, { data: purchases }, { data: admins }, { data: invitations }] =
    await Promise.all([
      supabase
        .from("organization_students")
        .select("user_id, status, joined_via, removed_at, removed_reason, created_at")
        .eq("organization_id", membership.organizationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("purchases")
        .select("user_id, amount_paid")
        .eq("organization_id", membership.organizationId),
      supabase
        .from("organization_admins")
        .select("user_id, role, created_at")
        .eq("organization_id", membership.organizationId)
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("id, email, invite_type, expires_at, created_at")
        .eq("organization_id", membership.organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  const allUserIds = [
    ...new Set([
      ...(students ?? []).map((s) => s.user_id),
      ...(admins ?? []).map((a) => a.user_id),
    ]),
  ];

  const profilesById = new Map<string, ProfileInfo>();
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", allUserIds);

    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, { name: profile.name, email: profile.email });
    }
  }

  const totalSpentByUser = new Map<string, number>();
  for (const purchase of purchases ?? []) {
    totalSpentByUser.set(
      purchase.user_id,
      (totalSpentByUser.get(purchase.user_id) ?? 0) + purchase.amount_paid
    );
  }

  const alumnos = students ?? [];
  const administradores = admins ?? [];
  const invitacionesPendientes = invitations ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Alumnos y administradores de tu organización.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Alumnos</h2>
        <div className="mt-4">
          <InviteForm
            action={inviteStudentAction}
            placeholder="correo@alumno.com"
            submitLabel="Invitar alumno"
          />
        </div>

        {alumnos.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Todavía no hay alumnos registrados.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Total gastado</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {alumnos.map((alumno, index) => {
                  const profile = profilesById.get(alumno.user_id);
                  return (
                    <tr
                      key={alumno.user_id}
                      className={index !== alumnos.length - 1 ? "border-b border-border" : ""}
                    >
                      <td className="px-4 py-3 font-medium">{profile?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {profile?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {(totalSpentByUser.get(alumno.user_id) ?? 0).toLocaleString("es-ES")} €
                      </td>
                      <td className="px-4 py-3">
                        {alumno.status === "active" ? (
                          <span className="text-muted-foreground">Activo</span>
                        ) : (
                          <span className="font-medium text-red-600">Echado</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StudentActions studentUserId={alumno.user_id} status={alumno.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Administradores de la empresa</h2>

        {membership.role === "owner" && (
          <div className="mt-4">
            <InviteForm
              action={inviteAdminAction}
              placeholder="correo@admin.com"
              submitLabel="Invitar admin"
            />
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {administradores.map((admin, index) => {
                const profile = profilesById.get(admin.user_id);
                const isSelf = admin.user_id === user?.id;
                return (
                  <tr
                    key={admin.user_id}
                    className={index !== administradores.length - 1 ? "border-b border-border" : ""}
                  >
                    <td className="px-4 py-3 font-medium">{profile?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{profile?.email ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{admin.role}</td>
                    <td className="px-4 py-3 text-right">
                      {membership.role === "owner" && !isSelf && (
                        <AdminActions adminUserId={admin.user_id} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {invitacionesPendientes.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Caduca</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {invitacionesPendientes.map((invitation, index) => (
                  <tr
                    key={invitation.id}
                    className={
                      index !== invitacionesPendientes.length - 1 ? "border-b border-border" : ""
                    }
                  >
                    <td className="px-4 py-3 font-medium">{invitation.email}</td>
                    <td className="px-4 py-3 capitalize">
                      {invitation.invite_type === "admin" ? "Admin" : "Alumno"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(invitation.expires_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RevokeInvitationButton invitationId={invitation.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
