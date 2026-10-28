import { createFileRoute } from "@tanstack/react-router";

/**
 * Public health check (no secrets, no tenant data - coarse component status
 * and timestamps only). Returns 503 when anything critical is down so an
 * external monitor can alert the owner before the client notices.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { db } = await import("@/lib/db.server");
        const { buildHealthReport, healthHttpStatus } = await import("@/lib/health.server");
        const report = await buildHealthReport(await db());
        return Response.json(report, { status: healthHttpStatus(report) });
      },
    },
  },
});
