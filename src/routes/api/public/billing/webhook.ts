import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { assertPayFastSource, verifyPayFastWebhook } = await import("@/lib/billing.server");
          assertPayFastSource(request);
          const result = await verifyPayFastWebhook(request);
          return Response.json(result);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "unknown";
          console.error("PayFast webhook rejected", reason);
          // A rejected ITN is either an attack or a real payment we failed to apply (bad config, PayFast change).
          const { sendAlert } = await import("@/lib/alert.server");
          await sendAlert({ key: "payfast:rejected", severity: "warning", title: "PayFast notification rejected", detail: reason });
          return Response.json({ ok: false, error: "Rejected" }, { status: 400 });
        }
      },
    },
  },
});
