import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAdmin } from "@/lib/auth/requireOrgAdmin";
import { isUuid } from "@/lib/mux/validation";

export async function GET(request: Request) {
  const lessonId=new URL(request.url).searchParams.get("lessonId");
  if (!isUuid(lessonId)) return Response.json({ error:"Lección no válida." },{status:400});
  const supabase=await createClient();
  const auth=await requireOrgAdmin(supabase,{lessonId});
  if (auth.error) return Response.json({error:auth.error},{status:403});
  const lesson=await supabase.from("lessons").select("course_id").eq("id",lessonId).single();
  const course=lesson.data ? await supabase.from("courses").select("organization_id").eq("id",lesson.data.course_id).single() : null;
  if (!course?.data) return Response.json({error:"Lección no encontrada."},{status:404});
  const admin=createAdminClient();
  const [usage,billing]=await Promise.all([admin.rpc("platform_library_usage",{p_organization_id:course.data.organization_id}),admin.from("organization_billing").select("offer_version,library_limit_seconds").eq("organization_id",course.data.organization_id).single()]);
  if (usage.error||billing.error) return Response.json({error:"Capacidad pendiente de verificación. No se interpreta como cero."},{status:503});
  return Response.json({activeSeconds:usage.data.active_seconds,reservedSeconds:usage.data.reserved_seconds,committedSeconds:usage.data.committed_seconds,releaseAt:usage.data.release_at,limitSeconds:billing.data.offer_version?billing.data.library_limit_seconds:null},{headers:{"Cache-Control":"private, no-store"}});
}
