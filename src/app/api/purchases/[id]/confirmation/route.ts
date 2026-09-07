import { createClient } from "@/lib/supabase/server";
import { courseConfirmationText } from "@/lib/legal/courseConfirmation";
import { isUuid } from "@/lib/mux/validation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isUuid(id)) return new Response("No encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Debes iniciar sesión", { status: 401 });
  const { data: purchase, error } = await supabase.from("purchases")
    .select("id,organization_id,created_at,amount_paid,contract_snapshot")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !purchase) return new Response("No encontrado", { status: 404 });
  return new Response(courseConfirmationText(purchase), { headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="compra-${id}.txt"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
