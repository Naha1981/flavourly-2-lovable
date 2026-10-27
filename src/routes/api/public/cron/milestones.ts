import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/milestones")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { runDailyMilestones } = await import("@/lib/milestones.server");
        const { runCronJob } = await import("@/lib/heartbeat.server");
        return runCronJob("milestones", () => runDailyMilestones());
      },
    },
  },
});
