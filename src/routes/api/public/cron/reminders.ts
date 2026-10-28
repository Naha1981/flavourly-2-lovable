import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runReminders } = await import("@/lib/reminders.server");
        const { runFeedbackRequests } = await import("@/lib/reputation.server");
        const { withCronAlert } = await import("@/lib/alerts.server");
        // One schedule drives both the reminder ladder and post-visit feedback requests.
        return Response.json({
          ok: true,
          result: await withCronAlert("reminders", async () => ({
            reminders: await runReminders(),
            feedback: await runFeedbackRequests(),
          })),
        });
      },
    },
  },
});
