import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AuthCheck = { error: string | null };

type OrgScope =
  | { organizationId: string }
  | { courseId: string }
  | { sectionId: string }
  | { lessonId: string };

async function resolveOrganizationId(
  supabase: SupabaseServerClient,
  scope: OrgScope
): Promise<string | null> {
  if ("organizationId" in scope) return scope.organizationId;

  if ("courseId" in scope) {
    const { data } = await supabase
      .from("courses")
      .select("organization_id")
      .eq("id", scope.courseId)
      .single();
    return data?.organization_id ?? null;
  }

  if ("sectionId" in scope) {
    const { data: section } = await supabase
      .from("sections")
      .select("course_id")
      .eq("id", scope.sectionId)
      .single();
    if (!section) return null;
    return resolveOrganizationId(supabase, { courseId: section.course_id });
  }

  const { data: lesson } = await supabase
    .from("lessons")
    .select("course_id")
    .eq("id", scope.lessonId)
    .single();
  if (!lesson) return null;
  return resolveOrganizationId(supabase, { courseId: lesson.course_id });
}

/** Admin de LA organización dueña del curso/sección/lección indicado (o super_admin). */
export async function requireOrgAdmin(
  supabase: SupabaseServerClient,
  scope: OrgScope
): Promise<AuthCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const organizationId = await resolveOrganizationId(supabase, scope);
  if (!organizationId) {
    return { error: "No se encontró el curso o la organización." };
  }

  const { data: isOrgAdmin } = await supabase.rpc("is_org_admin", {
    org_id: organizationId,
  });

  if (!isOrgAdmin) {
    return { error: "No tienes permisos de administrador para esta organización." };
  }

  return { error: null };
}

/** Solo el OWNER de la organización dueña del recurso indicado (o super_admin) — para acciones sensibles como conectar pagos. */
export async function requireOrgOwner(
  supabase: SupabaseServerClient,
  scope: OrgScope
): Promise<AuthCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const organizationId = await resolveOrganizationId(supabase, scope);
  if (!organizationId) {
    return { error: "No se encontró la organización." };
  }

  const { data: isOwner } = await supabase.rpc("is_org_owner", {
    org_id: organizationId,
  });

  if (!isOwner) {
    return { error: "Solo el propietario de la empresa puede hacer esto." };
  }

  return { error: null };
}

/** Solo el super_admin de la plataforma (no admins de organización normales). */
export async function requireSuperAdmin(
  supabase: SupabaseServerClient
): Promise<AuthCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");

  if (!isSuperAdmin) {
    return { error: "No tienes permisos de super administrador." };
  }

  return { error: null };
}

/**
 * Admin de CUALQUIER organización (o super_admin), sin comprobar una en
 * concreto. Pensado para acciones que todavía no reciben suficiente contexto
 * como para saber de qué organización es el recurso (p. ej. la subida de
 * media, que sube el archivo antes de asociarlo a ninguna lección) — ver
 * Fase 9 del plan para el seguimiento de ese hueco.
 */
export async function isAnyOrgAdmin(
  supabase: SupabaseServerClient,
  userId: string
): Promise<boolean> {
  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (isSuperAdmin) return true;

  const { count } = await supabase
    .from("organization_admins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return Boolean(count);
}

export async function requireAnyOrgAdmin(
  supabase: SupabaseServerClient
): Promise<AuthCheck> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión para hacer esto." };
  }

  if (!(await isAnyOrgAdmin(supabase, user.id))) {
    return { error: "No tienes permisos de administrador." };
  }

  return { error: null };
}
