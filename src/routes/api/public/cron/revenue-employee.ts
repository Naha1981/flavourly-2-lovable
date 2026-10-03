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
        const c = await db();
        const { data: tenants } = await c.from("tenant_profiles").select("tenant_id").limit(100);
        const results = [];
        for (const tenant of tenants ?? []) {
          results.push({
            tenantId: String(tenant.tenant_id),
            result: await runRevenueEmployee({ tenantId: String(tenant.tenant_id) }),
          });
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});
