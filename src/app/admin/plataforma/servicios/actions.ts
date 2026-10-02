"use server";

import { redirect } from "next/navigation";
import { readIntegrationReadiness } from "@/lib/integrations/readiness";
import { createStripeApiClient } from "@/lib/stripe/config";
import { prepareCapacityCatalogue } from "@/lib/stripe/prepareCapacityCatalogue";

export async function prepareCatalogueAction() {
  const readiness = await readIntegrationReadiness();
  if (!readiness.ok) redirect("/admin");
  let prepared = false;
  if (readiness.report.stripeMode === "live" && readiness.report.account.state === "verified" && readiness.report.account.data.chargesEnabled) {
    try {
      await prepareCapacityCatalogue(createStripeApiClient());
      prepared = true;
    } catch { /* No SDK errors or credentials in redirects, HTML or logs. */ }
  }
  redirect(`/admin/plataforma/servicios?catalogue=${prepared ? "ready" : "failed"}`);
}
