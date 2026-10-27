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
        const { runCronJob } = await import("@/lib/heartbeat.server");
        const { sendAlert } = await import("@/lib/alert.server");
        return runCronJob("revenue-employee", async () => {
          const c = await db();
          const { data: tenants } = await c.from("tenant_profiles").select("tenant_id").limit(100);
          const results: Array<{ tenantId: string; result?: unknown; error?: string }> = [];
          for (const tenant of tenants ?? []) {
            const tenantId = String(tenant.tenant_id);
            // One restaurant's failure must not stop everyone else's run.
            try {
              results.push({ tenantId, result: await runRevenueEmployee({ tenantId }) });
            } catch (error) {
              results.push({ tenantId, error: error instanceof Error ? error.message.slice(0, 200) : "failed" });
            }
          }
          const failed = results.filter((r) => r.error);
          if (failed.length > 0) {
            await sendAlert({
              key: "revenue-employee:tenant-failures",
              severity: "warning",
              title: `Revenue agent failed for ${failed.length} of ${results.length} restaurants`,
              detail: failed.slice(0, 5).map((r) => `${r.tenantId}: ${r.error}`).join("\n"),
            });
          }
          if ((tenants?.length ?? 0) >= 100) {
            await sendAlert({ key: "revenue-employee:limit", severity: "warning", title: "Revenue agent hit its 100-restaurant limit", detail: "Some restaurants are not being processed. Paginate the cron job." });
          }
          return results;
        });
      },
    },
  },
});
