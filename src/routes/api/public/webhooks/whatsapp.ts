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
        if (!secret && process.env["WHATSAPP_CUSTOMER_OWNED_ENABLED"] !== "true")
          return new Response("Not configured", { status: 500 });

        const rawBody = await request.text();
        const provided = (
          request.headers.get("x-zernio-signature") ??
          request.headers.get("x-late-signature") ??
          ""
        )
          .replace(/^sha256=/i, "")
          .trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const { customerOwnedEnabled, verifyTenantWebhook } =
          await import("@/lib/tenant-whatsapp.server");
        let tenantVerified = false;
        // A rollback flag must not turn a customer route into a shared-secret route.
        if (!customerOwnedEnabled()) {
          const payload = parsed as {
            account?: { accountId?: string; id?: string; profileId?: string };
            message?: { account?: { accountId?: string; id?: string; profileId?: string } };
          };
          const account = payload?.account ?? payload?.message?.account;
          if (account?.profileId && (account.accountId ?? account.id)) {
            const { db } = await import("@/lib/db.server");
            const mapping = await (
              await db()
            )
              .from("wa_channels")
              .select("*")
              .eq("account_id", account.accountId ?? account.id)
              .eq("profile_id", account.profileId)
              .maybeSingle();
            if (mapping.error) return new Response("Verification unavailable", { status: 503 });
            if (mapping.data?.credential_mode === "customer")
              return new Response("Customer messaging paused", { status: 503 });
          }
        }
        if (customerOwnedEnabled()) {
          try {
            tenantVerified = await verifyTenantWebhook(parsed, rawBody, provided);
          } catch {
            return new Response("Verification unavailable", { status: 503 });
          }
          if (!tenantVerified) return new Response("Invalid signature", { status: 401 });
        }
        const expected = createHmac("sha256", secret ?? "unused-customer-route")
          .update(rawBody)
          .digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (!tenantVerified && (a.length !== b.length || !timingSafeEqual(a, b))) {
          return new Response("Invalid signature", { status: 401 });
        }

        const disconnected = parsed as {
          event?: string;
          account?: { accountId?: string; id?: string; profileId?: string };
        };
        if (tenantVerified && disconnected.event === "account.disconnected") {
          const { db } = await import("@/lib/db.server");
          const c = await db();
          const a = disconnected.account;
          const mapped = await c
            .from("wa_channels")
            .select("tenant_id")
            .eq("account_id", a?.accountId ?? a?.id)
            .eq("profile_id", a?.profileId)
            .maybeSingle();
          if (mapped.error || !mapped.data)
            return new Response("Unmapped account", { status: 401 });
          const held = await c
            .from("wa_tenant_credentials")
            .update({ state: "needs_attention" })
            .eq("tenant_id", mapped.data.tenant_id);
          if (held.error) return new Response("Could not pause connection", { status: 503 });
          const paused = await c
            .from("tenant_profiles")
            .update({ auto_replies_enabled: false })
            .eq("tenant_id", mapped.data.tenant_id);
          if (paused.error) return new Response("Could not pause replies", { status: 503 });
          return Response.json({ ok: true, paused: true });
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
