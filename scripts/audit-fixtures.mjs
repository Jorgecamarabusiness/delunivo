/** Datos deliberadamente ficticios para la suite de auditoría local. */
export const AUDIT_PORT = 3217;
export const AUDIT_SUPABASE_PORT = 55473;

export const ids = {
  orgA: "10000000-0000-4000-8000-000000000001",
  orgB: "10000000-0000-4000-8000-000000000002",
  ownerA: "20000000-0000-4000-8000-000000000001",
  ownerB: "20000000-0000-4000-8000-000000000002",
  studentA: "20000000-0000-4000-8000-000000000003",
  superadmin: "20000000-0000-4000-8000-000000000004",
  courseA: "30000000-0000-4000-8000-000000000001",
  lessonA: "40000000-0000-4000-8000-000000000001",
  sectionA: "50000000-0000-4000-8000-000000000001",
  assetA: "60000000-0000-4000-8000-000000000001",
  blockA: "70000000-0000-4000-8000-000000000001",
};

export const accounts = {
  anonymous: null,
  studentA: { id: ids.studentA, email: "alumna-a@example.test", password: "Audit-student-Aa1", token: "audit.student-a" },
  studentInvited: { id: "20000000-0000-4000-8000-000000000005", email: "invitada-a@example.test", password: "Audit-invited-Aa1", token: "audit.student-invited" },
  ownerA: { id: ids.ownerA, email: "owner-a@example.test", password: "Audit-owner-Aa1", token: "audit.owner-a" },
  ownerB: { id: ids.ownerB, email: "owner-b@example.test", password: "Audit-owner-Bb1", token: "audit.owner-b" },
  superadmin: { id: ids.superadmin, email: "superadmin@example.test", password: "Audit-superadmin-Sa1", token: "audit.superadmin" },
};

export const organizations = {
  orgA: { id: ids.orgA, name: "Escuela A sintética", slug: "audit-org-a", owner_id: ids.ownerA, tagline_template: null, hero_subtitle: "Entorno aislado de auditoría", featured_course_id: ids.courseA, logo_url: null, primary_color: "#155e75" },
  orgB: { id: ids.orgB, name: "Escuela B sintética", slug: "audit-org-b", owner_id: ids.ownerB, tagline_template: null, hero_subtitle: "Sin acceso a A", featured_course_id: null, logo_url: null, primary_color: "#155e75" },
};

export const courseA = { id: ids.courseA, organization_id: ids.orgA, title: "Curso aislado", status: "published" };
export const lessonA = {
  id: ids.lessonA, course_id: ids.courseA, section_id: ids.sectionA, title: "Lección de vídeo", status: "published", order_index: 1,
  blocks: [{ id: ids.blockA, type: "video_file", mux_video_asset_id: ids.assetA }],
};
export const sectionA = { id: ids.sectionA, course_id: ids.courseA, title: "Inicio", status: "published", order_index: 1 };
export const assetA = { id: ids.assetA, organization_id: ids.orgA, course_id: ids.courseA, lesson_id: ids.lessonA, block_id: ids.blockA, mux_playback_id: "audit-playback-id", status: "ready", is_current: true, duration_seconds: 60 };

export function accountForToken(token = "") {
  return Object.values(accounts).find((account) => account && token.includes(account.token)) ?? null;
}

export function accountForEmail(email = "") {
  return Object.values(accounts).find((account) => account?.email === email) ?? null;
}

export function userFor(account) {
  return account && { id: account.id, email: account.email, aud: "authenticated", role: "authenticated", user_metadata: { name: account.email.split("@")[0] } };
}
