import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/customer-lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runCustomerLifecycle } = await import("@/lib/customer-lifecycle.server");
        return Response.json({ ok: true, result: await runCustomerLifecycle() });
      },
    },
  },
});
