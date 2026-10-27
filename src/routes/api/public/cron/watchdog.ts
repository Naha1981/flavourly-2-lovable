import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Run every 5 minutes. Evaluates health and alerts the operator (throttled to once per 6 h per problem). */
export const Route = createFileRoute("/api/public/cron/watchdog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runWatchdog } = await import("@/lib/watchdog.server");
        return Response.json({ ok: true, result: await runWatchdog() });
      },
    },
  },
});
