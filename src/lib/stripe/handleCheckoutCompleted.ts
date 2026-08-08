import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Compartido por el webhook de la cuenta principal y el de Connect — misma lógica de compra, distinta cuenta de Stripe de origen. */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const courseId = session.metadata?.course_id;
  const userId = session.metadata?.user_id;

  if (!courseId || !userId) return;

  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from("courses")
    .select("organization_id")
    .eq("id", courseId)
    .single();

  if (!course) {
    throw new Error("Curso no encontrado.");
  }

  const amountPaid = (session.amount_total ?? 0) / 100;

  const { error } = await supabase.from("purchases").upsert(
    {
      user_id: userId,
      course_id: courseId,
      organization_id: course.organization_id,
      amount_paid: amountPaid,
      payment_method: "stripe",
      external_reference: session.id,
    },
    { onConflict: "user_id,course_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  // Si nunca se había unido al roster de esta organización (p. ej. compró
  // sin haberse registrado antes en su subdominio), se le añade activo. Si
  // ya existe una fila (incluso 'removed' por haber sido expulsado), no se
  // toca — una compra nunca reactiva a alguien echado automáticamente.
  const { data: existingMembership } = await supabase
    .from("organization_students")
    .select("id")
    .eq("organization_id", course.organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingMembership) {
    const { error: membershipError } = await supabase
      .from("organization_students")
      .insert({
        organization_id: course.organization_id,
        user_id: userId,
        status: "active",
        joined_via: "purchase",
      });

    if (membershipError) {
      throw new Error(membershipError.message);
    }
  }
}
