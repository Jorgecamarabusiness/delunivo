import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { RequestForm } from "./RequestForm";
import { buttonClassName } from "@/components/ui/Button";
import { isPersonalPreviewMode, PERSONAL_PREVIEW_MESSAGE } from "@/lib/personal-preview";
export default async function CustomPlanPage() {
  if (isPersonalPreviewMode()) return <AuthShell title="Proyecto personal en pausa" subtitle={PERSONAL_PREVIEW_MESSAGE}><Link className={buttonClassName("outline", "md")} href="/">Volver al inicio</Link></AuthShell>;
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
  return <AuthShell title="Un plan a medida" subtitle="Describe tu escuela y la capacidad que necesitas. Acordaremos precio y condiciones antes de contratar.">{user?<RequestForm />:<div className="mt-6 space-y-4"><p className="text-sm text-muted-foreground">Inicia sesión para registrar tu solicitud de forma segura.</p><Link className={buttonClassName("primary","md")} href="/login?next=%2Fa-medida">Iniciar sesión</Link></div>}</AuthShell>;
}
