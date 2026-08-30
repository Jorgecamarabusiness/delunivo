"use server";

import { redirect } from "next/navigation";
import { requireOwnerContext } from "@/lib/organizations/requireOwnerContext";
import { stripe } from "@/lib/stripe/client";
import { describeStripeError } from "@/lib/stripe/errors";
import type { ActionResult } from "@/types";

/**
 * País de las cuentas conectadas. Stripe lo pide obligatoriamente y NO se puede
 * cambiar una vez creada la cuenta; prellenarlo evita un paso al cliente.
 * Si algún día hay clientes fuera de España, esto pasa a ser un campo del
 * formulario en vez de una constante.
 */
const CONNECT_COUNTRY = "ES";

export async function connectStripeAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const auth = await requireOwnerContext();
  if (!auth.ok) return { error: auth.error };
  const { context } = auth;

  const { data: organization } = await context.supabase
    .from("organizations")
    .select("name")
    .eq("id", context.organizationId)
    .maybeSingle();

  const {
    data: { user },
  } = await context.supabase.auth.getUser();

  const { data: existing } = await context.supabase
    .from("organization_integrations")
    .select("stripe_account_id")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;

  let onboardingUrl: string;
  try {
    // Si ya hay una cuenta pero el cliente nunca terminó el alta, se descarta y
    // se crea otra prellenada. Una cuenta sin `details_submitted` no tiene
    // saldo ni historial, así que borrarla no pierde nada — y si se reutilizara
    // volvería a enseñar el formulario largo, sin los datos ya rellenos.
    if (accountId) {
      const account = await stripe.accounts.retrieve(accountId);
      if (!account.details_submitted) {
        await stripe.accounts.del(accountId).catch(() => {
          // Si Stripe no deja borrarla, seguimos con la que hay: peor
          // experiencia, pero nunca un callejón sin salida.
        });
        accountId = null;
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: CONNECT_COUNTRY,
        // Prellenar email, tipo de negocio y nombre quita las tres primeras
        // pantallas del onboarding. Lo que queda (identidad y cuenta bancaria)
        // lo exige la normativa y Stripe no permite omitirlo.
        email: user?.email ?? undefined,
        business_type: "individual",
        default_currency: "eur",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: organization?.name ?? undefined,
        },
        metadata: { organization_id: context.organizationId },
      });
      accountId = account.id;

      const { error: saveError } = await context.supabase
        .from("organization_integrations")
        .upsert(
          {
            organization_id: context.organizationId,
            stripe_account_id: accountId,
            stripe_connect_status: "pending",
          },
          { onConflict: "organization_id" }
        );

      // Si no se puede guardar, la cuenta recién creada quedaría huérfana en
      // Stripe y el siguiente intento crearía otra. Se borra y se avisa.
      if (saveError) {
        await stripe.accounts.del(accountId).catch(() => {});
        return { error: saveError.message };
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl}/admin/configuracion?stripe=refresh`,
      return_url: `${siteUrl}/admin/configuracion?stripe=return`,
      type: "account_onboarding",
      // Solo lo imprescindible para empezar a cobrar; el resto Stripe lo pedirá
      // más adelante, cuando toque, en vez de todo de golpe al principio.
      collection_options: { fields: "currently_due" },
    });

    onboardingUrl = accountLink.url;
  } catch (stripeError) {
    return { error: describeStripeError(stripeError) };
  }

  redirect(onboardingUrl);
}
