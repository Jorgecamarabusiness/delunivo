"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwnerContext } from "@/lib/organizations/requireOwnerContext";
import { createCapacityCheckout, quoteCapacityChange, confirmCapacityChange, settleCapacityCheckouts } from "@/lib/stripe/capacityBilling";
import { getPlan, OFFER_VERSION } from "@/lib/billing/catalog";

export type CapacityActionState = { error: string | null; message?: string; quote?: { id: string; kind: string; initialCents: number; recurringCents: number; cycleEnd: string; prorationAt: string; libraryQuantity: number; planKey: string } };
const describe = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación.";
export async function purchaseCapacityAction(_: CapacityActionState, form: FormData): Promise<CapacityActionState> {
  const auth = await requireOwnerContext({ allowInactive: true, organizationId: String(form.get("organizationId") ?? "") });
  if (!auth.ok) return { error: auth.error };
  if (form.get("acceptOffer") !== "yes" || form.get("offerVersion") !== OFFER_VERSION) return { error: "Acepta la oferta y sus condiciones vigentes antes de pagar." };
  const key = String(form.get("planKey") ?? ""); const plan = getPlan(key);
  if (!plan && key !== "delivery_pack") return { error: "Oferta no válida." };
  let url: string;
  try { await settleCapacityCheckouts(auth.context.organizationId); url = await createCapacityCheckout(auth.context.organizationId, auth.context.userId, plan?.key ?? "delivery_pack"); }
  catch (error) { return { error: describe(error) }; }
  redirect(url);
}
export async function previewCapacityAction(_: CapacityActionState, form: FormData): Promise<CapacityActionState> {
  const auth = await requireOwnerContext({ allowInactive: true, organizationId: String(form.get("organizationId") ?? "") });
  if (!auth.ok) return { error: auth.error };
  const kind = String(form.get("kind") ?? "");
  if (!["upgrade","downgrade","library","cancel","resume"].includes(kind)) return { error: "Operación no válida." };
  const target = getPlan(form.get("planKey"));
  const quantity = form.get("libraryQuantity");
  try {
    await settleCapacityCheckouts(auth.context.organizationId);
    const op = await quoteCapacityChange(auth.context.organizationId, auth.context.userId, kind as "upgrade"|"downgrade"|"library"|"cancel"|"resume", target?.key, quantity === null ? undefined : Number(quantity));
    return { error: null, quote: { id: op.id, kind: op.kind, initialCents: op.quote.initialCents, recurringCents: op.quote.recurringCents, cycleEnd: op.quote.cycleEnd, prorationAt: op.quote.prorationAt, libraryQuantity: op.quote.libraryQuantity, planKey: op.quote.planKey } };
  } catch (error) { return { error: describe(error) }; }
}
export async function confirmCapacityAction(_: CapacityActionState, form: FormData): Promise<CapacityActionState> {
  const auth = await requireOwnerContext({ allowInactive: true, organizationId: String(form.get("organizationId") ?? "") });
  if (!auth.ok) return { error: auth.error };
  if (form.get("acceptOffer") !== "yes" || form.get("offerVersion") !== OFFER_VERSION) return { error: "Acepta la oferta antes de confirmar." };
  let result: { url: string | null; status: string };
  try { await settleCapacityCheckouts(auth.context.organizationId); result = await confirmCapacityChange(auth.context.organizationId, String(form.get("operationId") ?? "")); }
  catch (error) { return { error: describe(error) }; }
  if (result.url) redirect(result.url);
  revalidatePath("/admin/facturacion");
  return { error: null, message: result.status === "scheduled" ? "Cambio programado para la siguiente renovación." : result.status === "pending_payment" ? "Pago pendiente. La capacidad se activará tras confirmación." : "Operación confirmada." };
}
