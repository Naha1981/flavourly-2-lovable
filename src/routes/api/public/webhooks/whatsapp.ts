import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Incoming signed WhatsApp inbox webhook.
 * Requests are HMAC-SHA256 signed over the raw body with the server webhook secret.
 * Every verified delivery is logged in wa_webhook_events so failures can be
 * retried safely from the WhatsApp health page.
 */
export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["ZERNIO_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const rawBody = await request.text();
        const provided = (
          request.headers.get("x-zernio-signature") ??
          request.headers.get("x-late-signature") ??
          ""
        )
          .replace(/^sha256=/i, "")
          .trim();

        const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { ingestPayload, tenantOf } = await import("@/lib/webhook-ingest.server");
        const { db } = await import("@/lib/db.server");
        const tenantId = tenantOf(parsed);

        let result: Awaited<ReturnType<typeof ingestPayload>>;
        try {
          result = await ingestPayload(parsed);
        } catch (e) {
          result = {
            events: 0,
            saved: 0,
            failures: [e instanceof Error ? e.message : "unexpected error"],
          };
        }
        const failed = result.failures.length > 0;

        await (await db()).from("wa_webhook_events").insert({
          tenant_id: result.tenantId ?? tenantId,
          status: failed ? "failed" : "processed",
          error: failed ? result.failures.join("; ").slice(0, 500) : null,
          // Keep the body only when we may need to retry it.
          raw_body: failed ? rawBody.slice(0, 50000) : null,
          event_count: result.events,
          saved: result.saved,
        });

        return Response.json({ ok: !failed, saved: result.saved }, { status: failed ? 503 : 200 });
      },
    },
  },
});
