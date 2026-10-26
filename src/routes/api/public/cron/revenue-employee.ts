import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/revenue-employee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { db } = await import("@/lib/db.server");
        const { runRevenueEmployee } = await import("@/lib/intelligence/revenue-employee.server");
        const { listAllTenants } = await import("@/lib/tenants.server");
        const c = await db();
        const { getCronWatermark, rotateAfter, setCronWatermark } = await import("@/lib/tenants.server");
        const tenants = await listAllTenants(c, "tenant_id");
        // Default 120s sits below the 150s free-plan edge wall-clock limit
        // (supabase.com/docs/guides/functions/limits); the Lovable Cloud
        // server-route timeout is unpublished, so keep this env-configurable.
        const budgetMs = Number(process.env["FLAVOURLY_CRON_TIME_BUDGET_MS"] || 120_000);
        const maxTenants = Number(process.env["FLAVOURLY_CRON_MAX_TENANTS_PER_RUN"] || 0) || Infinity;
        const deadline = Date.now() + budgetMs;
        const watermark = await getCronWatermark(c, "revenue-employee");
        const ordered = rotateAfter(tenants ?? [], (t) => String(t["tenant_id"]), watermark);
        const results = [];
        let failed = 0;
        let lastCompleted: string | null = null;
        for (const tenant of ordered) {
          if (results.length + failed >= maxTenants || Date.now() > deadline) break;
          const tenantId = String(tenant["tenant_id"]);
          try {
            results.push({
              tenantId,
              result: await runRevenueEmployee({ tenantId }),
            });
          } catch (error) {
            failed += 1;
            console.error("revenue-employee tenant failed", tenantId, error);
          }
          lastCompleted = tenantId;
        }
        if (lastCompleted) await setCronWatermark(c, "revenue-employee", lastCompleted);
        return Response.json({ ok: true, results, failed, remaining: ordered.length - results.length - failed });
      },
    },
  },
});
