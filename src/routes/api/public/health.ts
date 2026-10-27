import { createFileRoute } from "@tanstack/react-router";

/**
 * Public liveness/health probe for an external uptime monitor (UptimeRobot, BetterStack...).
 * Returns HTTP 503 when something critical is broken. Exposes names and ok-flags only:
 * no tenant data, counts or error text.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { evaluateHealth } = await import("@/lib/health.server");
        const report = await evaluateHealth();
        return Response.json(
          { status: report.status, checks: report.checks.map(({ name, ok }) => ({ name, ok })) },
          { status: report.status === "down" ? 503 : 200, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
