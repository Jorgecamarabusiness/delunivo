import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  importMuxUsage,
  importMuxHistoricalWindow,
} from "@/lib/mux/importUsage";
import { latestCompleteHour } from "@/lib/billing/allocation";
import {
  settleCapacityCheckouts,
  reconcileCapacityOperation,
} from "@/lib/stripe/capacityBilling";
import { stripe } from "@/lib/stripe/client";
import { updatePlatformBillingStatusForSubscription } from "@/lib/stripe/handlePlatformBilling";
import { reconcileCapacitySubscription } from "@/lib/stripe/capacityEvents";
import { sendEmail } from "@/lib/email/send";
import { getEmailDeliveryMode } from "@/lib/email/deliveryMode";
import { capacityNoticeContent } from "./notices";
import { readAllRows } from "./readAllRows";
import { reconcileMuxAssets } from "@/lib/mux/reconcileAssets";

export async function runCapacityMaintenance() {
  if (process.env.PLATFORM_CAPACITY_WORKER_ENABLED !== "true")
    return { state: "disabled" };
  const admin = createAdminClient();
  const failures: string[] = [];
  let imported = 0;
  if (process.env.MUX_USAGE_IMPORT_ENABLED === "true") {
    try {
      await reconcileMuxAssets();
      const end = latestCompleteHour(new Date());
      imported = (
        await importMuxUsage(new Date(end - 24 * 3600000), new Date(end))
      ).completed;
      imported += (await importMuxHistoricalWindow()).completed;
    } catch {
      failures.push("mux_import_failed");
    }
  }
  const schools = await readAllRows((from, to) =>
    admin
      .from("organization_billing")
      .select("organization_id,platform_subscription_id,pending_offer_snapshot")
      .or("offer_version.not.is.null,pending_offer_snapshot.not.is.null")
      .order("organization_id")
      .range(from, to),
  );
  if (schools.error) throw new Error(schools.error.message);
  for (const school of schools.data ?? []) {
    try {
      if (school.pending_offer_snapshot) {
        const trial = await admin.rpc("start_platform_trial", {
          p_organization_id: school.organization_id,
          p_offer: school.pending_offer_snapshot,
        });
        if (trial.error) throw new Error("trial_initialization_pending");
      }
      await settleCapacityCheckouts(school.organization_id);
      const ops = await admin
        .from("platform_billing_operations")
        .select("id")
        .eq("organization_id", school.organization_id)
        .in("status", ["processing", "pending_payment"]);
      if (ops.error) throw new Error(ops.error.message);
      for (const op of ops.data ?? []) await reconcileCapacityOperation(op.id);
      let confirmedEnd: string | null = null;
      if (school.platform_subscription_id) {
        const current = await stripe.subscriptions.retrieve(
          school.platform_subscription_id,
        );
        if (["active", "past_due", "canceled"].includes(current.status))
          await updatePlatformBillingStatusForSubscription(
            current.customer,
            current.id,
            current.status as "active" | "past_due" | "canceled",
            new Date(),
          );
        const latestInvoiceId =
          typeof current.latest_invoice === "string"
            ? current.latest_invoice
            : current.latest_invoice?.id;
        if (latestInvoiceId) {
          const latestInvoice = await stripe.invoices.retrieve(latestInvoiceId);
          if (latestInvoice.status === "paid")
            await reconcileCapacitySubscription(
              school.organization_id,
              current.id,
              latestInvoice.id,
            );
        }
        if (current.status === "canceled" && current.ended_at)
          confirmedEnd = new Date(current.ended_at * 1000).toISOString();
      }
      const retained = await admin.rpc("reconcile_platform_retention", {
        p_organization_id: school.organization_id,
        p_confirmed_end: confirmedEnd,
      });
      const notices = await admin.rpc("enqueue_platform_resource_notices", {
        p_organization_id: school.organization_id,
      });
      if (retained.error || notices.error)
        throw new Error("capacity_reconciliation_failed");
    } catch {
      failures.push(`school_reconciliation_failed:${school.organization_id}`);
    }
  }
  let sent = 0;
  if (
    process.env.PLATFORM_CAPACITY_NOTICES_ENABLED === "true" &&
    getEmailDeliveryMode() !== "off"
  ) {
    const claimed = await admin.rpc("claim_platform_resource_notices", {
      p_limit: 30,
    });
    if (claimed.error) throw new Error(claimed.error.message);
    for (const notice of claimed.data ?? []) {
      const owner = await admin
        .from("organizations")
        .select("owner_id")
        .eq("id", notice.organization_id)
        .single();
      const profile = owner.data
        ? await admin
            .from("profiles")
            .select("email")
            .eq("id", owner.data.owner_id)
            .single()
        : null;
      const result = profile?.data?.email
        ? await sendEmail({
            to: profile.data.email,
            subject: "Aviso de capacidad y conservación de Delunivo",
            content: capacityNoticeContent(
              notice.resource,
              notice.threshold,
              notice.payload,
            ),
            idempotencyKey: `capacity-notice-${notice.id}`,
          })
        : { error: "owner_email_unavailable" };
      const saved = await admin
        .from("platform_resource_notices")
        .update({
          sent_at: result.error ? null : new Date().toISOString(),
          last_error: result.error,
          lease_until: null,
        })
        .eq("id", notice.id)
        .eq("lease_until", notice.lease_until);
      if (saved.error || result.error) failures.push("notice_delivery_failed");
      else sent++;
    }
  }
  let retained = 0;
  // Launch requires the explicit version, rather than a permissive default.
  if (process.env.PLATFORM_RETENTION_EXECUTE === "2026-10-01") {
    const jobs = await admin.rpc("claim_platform_retention_jobs", {
      p_limit: 5,
    });
    if (jobs.error) throw new Error(jobs.error.message);
    for (const job of jobs.data ?? []) {
      try {
        await settleCapacityCheckouts(job.organization_id);
        const result = await admin.rpc("execute_platform_retention", {
          p_organization_id: job.organization_id,
          p_lease_until: job.lease_until,
          p_execute: true,
        });
        if (result.error) throw new Error(result.error.message);
        if (result.data === "completed") retained++;
      } catch {
        await admin
          .from("platform_retention_jobs")
          .update({
            status: "failed",
            lease_until: null,
            last_error: "retention_reconciliation_failed",
          })
          .eq("organization_id", job.organization_id)
          .eq("lease_until", job.lease_until);
        failures.push("retention_failed");
      }
    }
  }
  if (process.env.PLATFORM_RETENTION_EXECUTE === "2026-10-01") {
    const files = await admin
      .from("platform_storage_deletion_jobs")
      .select("id,bucket_id,object_name")
      .in("status", ["pending", "failed", "processing"])
      .or("attempts.lt.10,status.eq.processing")
      .order("id")
      .limit(50);
    if (files.error) throw new Error(files.error.message);
    for (const file of files.data ?? []) {
      const allowed = await admin.rpc("claim_platform_storage_cleanup", {
        p_job_id: file.id,
      });
      if (allowed.error || !allowed.data) continue;
      const claim = allowed.data;
      const removed = await admin.storage
        .from(claim.bucket)
        .remove([claim.name]);
      const saved = await admin
        .from("platform_storage_deletion_jobs")
        .update({
          // An uncertain provider result retains the durable restore barrier.
          status: removed.error ? "processing" : "completed",
          last_error: removed.error ? "storage_cleanup_failed" : null,
          completed_at: removed.error ? null : new Date().toISOString(),
        })
        .eq("id", file.id)
        .eq("claim_token", claim.token)
        .eq("status", "processing");
      if (removed.error || saved.error) failures.push("storage_cleanup_failed");
    }
  }
  return {
    imported,
    schools: schools.data?.length ?? 0,
    sent,
    retained,
    failures,
  };
}
