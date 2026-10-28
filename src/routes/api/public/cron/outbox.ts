import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/outbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { processOutbox } = await import("@/lib/outbox.server");
        const { withCronAlert } = await import("@/lib/alerts.server");
        return Response.json({ ok: true, result: await withCronAlert("outbox", () => processOutbox()) });
      },
    },
  },
});
