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
          console.error("PayFast webhook rejected", error);
          return Response.json({ ok: false, error: "Rejected" }, { status: 400 });
        }
      },
    },
  },
});
