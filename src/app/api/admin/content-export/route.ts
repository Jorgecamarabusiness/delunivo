import { requireOwnerContext } from "@/lib/organizations/requireOwnerContext";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMuxSigningClient } from "@/lib/mux/config";
import { playbackTokenLifetimeSeconds } from "@/lib/mux/playbackSession";
import { readAllRows } from "@/lib/billing/readAllRows";
import type { ContentBlock } from "@/types";

/** Own teaching content only. No purchases, private provider credentials or other tenants. */
export async function GET(request: Request) {
  const auth = await requireOwnerContext({ allowInactive: true, organizationId: new URL(request.url).searchParams.get("organizationId") ?? "" });
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 403 });
  const orgId = auth.context.organizationId; const admin = createAdminClient();
  const org = await admin.from("organizations").select("id,name,slug,logo_url").eq("id", orgId).single();
  const courses = await readAllRows((from,to)=>admin.from("courses").select("id,title,description,long_description,learning_points,thumbnail_url,status,price").eq("organization_id",orgId).order("id").range(from,to));
  if (org.error || courses.error) return Response.json({ error: "No se pudo verificar tu contenido." }, { status: 503 });
  const courseIds = courses.data!.map(c=>c.id);
  // Batch by course to avoid an unbounded PostgREST URL and retain explicit scope.
  const sections = []; const lessons = [];
  for (const courseId of courseIds) {
    const s = await readAllRows((from,to)=>admin.from("sections").select("id,course_id,title,order_index").eq("course_id",courseId).order("id").range(from,to));
    const l = await readAllRows((from,to)=>admin.from("lessons").select("id,course_id,section_id,title,status,order_index,blocks").eq("course_id",courseId).order("id").range(from,to));
    if (s.error || l.error) return Response.json({ error: "No se pudo completar la exportación; reintenta." }, { status: 503 });
    sections.push(...s.data!); lessons.push(...l.data!);
  }
  const assets = await readAllRows((from,to)=>admin.from("video_assets").select("id,mux_playback_id,status,duration_seconds").eq("organization_id",orgId).order("id").range(from,to));
  if (assets.error) return Response.json({ error: "Vídeos pendientes de exportación." }, { status: 503 });
  const media: { reference: string; kind: string; available: boolean; url?: string; limitation?: string }[] = [];
  const owned = await admin.rpc("platform_school_storage",{p_organization_id:orgId});
  if (owned.error) return Response.json({error:"La propiedad de los archivos está pendiente de verificación."},{status:503});
  const allowed = new Set((owned.data ?? []).filter((r:{download_allowed:boolean})=>r.download_allowed).map((r:{bucket_id:string;object_name:string})=>`${r.bucket_id}/${r.object_name}`));
  const references = new Set([org.data!.logo_url,...courses.data!.map(c=>c.thumbnail_url),...lessons.flatMap(l=>(l.blocks as ContentBlock[] ?? []).flatMap(b=>b.type==="video_file" ? [b.video_url] : b.type==="text" ? [...b.content.matchAll(/<img\s+(?:[^>]*\s+)?src\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]) : []))].filter((r): r is string=>Boolean(r)));
  for (const reference of references) {
    let bucket = "lesson-media", path = reference;
    if (/^https?:/i.test(reference)) {
      const parsed = new URL(reference);
      const source = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const matched = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/(lesson-media|public-media)\/(.+)$/);
      if (!source || parsed.origin !== new URL(source).origin || !matched) { media.push({reference,kind:"external",available:false,limitation:"Referencia externa; conserva tu archivo de origen."}); continue; }
      bucket=matched[1]; path=decodeURIComponent(matched[2]);
    }
    if (!path || path.includes("..") || path.startsWith("/") || !allowed.has(`${bucket}/${path}`)) { media.push({reference,kind:"storage",available:false,limitation:"Ruta sin propiedad exclusiva verificable."}); continue; }
    const signed = await admin.storage.from(bucket).createSignedUrl(path,3600,{download:true});
    media.push({reference,kind:"storage",available:!signed.error,...(signed.data ? {url:signed.data.signedUrl} : {limitation:"Archivo no disponible en Storage."})});
  }
  for (const asset of assets.data ?? []) {
    if (asset.status!=="ready" || !asset.mux_playback_id || !asset.duration_seconds) { media.push({reference:asset.id,kind:"mux",available:false,limitation:"Vídeo pendiente o no disponible."}); continue; }
    try {
      const token=await createMuxSigningClient().jwt.signPlaybackId(asset.mux_playback_id,{type:"video",expiration:`${playbackTokenLifetimeSeconds(asset.duration_seconds)}s`});
      media.push({reference:asset.id,kind:"mux",available:true,url:`https://stream.mux.com/${asset.mux_playback_id}.m3u8?token=${token}`,limitation:"Copia procesada HLS; no es el original. Descargas/entrega consumen Mux. No se activan extras ni MP4 pagados."});
    } catch { media.push({reference:asset.id,kind:"mux",available:false,limitation:"No se pudo firmar la copia procesada; reintenta o conserva tu original."}); }
  }
  return Response.json({version:"2026-10-01",exportedAt:new Date().toISOString(),organization:org.data,courses:courses.data,sections,lessons,media,
    instructions:"Guarda este manifiesto y descarga los medios disponibles antes de que caduquen sus enlaces. Storage: 1 hora; Mux: duración más 15 minutos. Las referencias externas y los originales Mux no se prometen disponibles. Esta salida no activa funciones de pago adicionales. Compras y facturas se conservan por separado.",
  },{headers:{"Cache-Control":"private, no-store","Content-Disposition":`attachment; filename="delunivo-${orgId}.json"`}});
}
