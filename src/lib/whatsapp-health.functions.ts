import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z.string().trim().min(1).max(80);
const MAX_RETRIES = 5;

const guard = async (tenantId: string) => {
  const { authorizeTenant, MANAGERS } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId, MANAGERS);
};

export type WebhookEvent = {
  id: string;
  status: string;
  error: string | null;
  eventCount: number;
  saved: number;
  retryCount: number;
  canRetry: boolean;
  receivedAt: string;
  lastRetryAt: string | null;
};

export type WhatsAppHealth = {
  operator: { reachable: boolean; latencyMs: number | null; error: string | null };
  account: { status: string; isConnected: boolean; phoneNumber: string | null; error: string | null } | null;
  events: WebhookEvent[];
  counts: { processed: number; failed: number; retried: number };
  lastDeliveryAt: string | null;
};

type Row = {
  id: string;
  status: string;
  error: string | null;
  event_count: number;
  saved: number;
  retry_count: number;
  received_at: string;
  last_retry_at: string | null;
  raw_body: string | null;
};

export const getWhatsAppHealth = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, waAccountId: z.string().min(1).max(100).nullable() }).parse(d),
  )
  .handler(async ({ data }): Promise<WhatsAppHealth> => {
    await guard(data.tenantId);
    const wa = await import("./whatsapp.server");
    const { db } = await import("./db.server");

    const started = Date.now();
    const [ping, account, evRes] = await Promise.all([
      (async () => {
        const base = process.env["OPERATOR_URL"];
        if (!base) return { reachable: false, latencyMs: null, error: "WhatsApp service isn't configured." };
        try {
          const res = await fetch(`${base.replace(/\/$/, "")}/health`);
          return {
            reachable: res.status < 500,
            latencyMs: Date.now() - started,
            error: res.status < 500 ? null : `Service answered ${res.status}`,
          };
        } catch {
          return { reachable: false, latencyMs: null, error: "Couldn't reach the WhatsApp service — it may be waking up." };
        }
      })(),
      data.waAccountId ? wa.status(data.tenantId, data.waAccountId) : Promise.resolve(null),
      (await db())
        .from("wa_webhook_events")
        .select("id, status, error, event_count, saved, retry_count, received_at, last_retry_at, raw_body")
        .eq("tenant_id", data.tenantId)
        .order("received_at", { ascending: false })
        .limit(50),
    ]);

    const rows = (evRes.data ?? []) as Row[];
    return {
      operator: ping,
      account: account
        ? account.ok
          ? {
              status: account.data.status,
              isConnected: account.data.isConnected,
              phoneNumber: account.data.phoneNumber,
              error: null,
            }
          : { status: "unknown", isConnected: false, phoneNumber: null, error: account.error }
        : null,
      events: rows.map((r) => ({
        id: r.id,
        status: r.status,
        error: r.error,
        eventCount: r.event_count,
        saved: r.saved,
        retryCount: r.retry_count,
        canRetry: r.status === "failed" && !!r.raw_body && r.retry_count < MAX_RETRIES,
        receivedAt: r.received_at,
        lastRetryAt: r.last_retry_at,
      })),
      counts: {
        processed: rows.filter((r) => r.status === "processed").length,
        failed: rows.filter((r) => r.status === "failed").length,
        retried: rows.filter((r) => r.status === "retried").length,
      },
      lastDeliveryAt: rows[0]?.received_at ?? null,
    };
  });

export const retryWebhookEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    await guard(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const { data: row } = await c
      .from("wa_webhook_events")
      .select("id, status, raw_body, retry_count")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.eventId)
      .maybeSingle();
    const r = row as Pick<Row, "id" | "status" | "raw_body" | "retry_count"> | null;
    if (!r) return { ok: false, message: "That delivery wasn't found." };
    if (r.status !== "failed") return { ok: false, message: "Only failed deliveries can be retried." };
    if (!r.raw_body) return { ok: false, message: "This delivery has no saved content to retry." };
    if (r.retry_count >= MAX_RETRIES) return { ok: false, message: "Retry limit reached for this delivery." };

    // Claim the retry atomically so double-clicks can't run it twice.
    const { data: claimed } = await c
      .from("wa_webhook_events")
      .update({ retry_count: r.retry_count + 1, last_retry_at: new Date().toISOString(), status: "retrying" })
      .eq("id", r.id)
      .eq("status", "failed")
      .eq("retry_count", r.retry_count)
      .select("id");
    if (!claimed?.length) return { ok: false, message: "A retry is already running." };

    const { ingestPayload } = await import("./webhook-ingest.server");
    let failures: string[];
    let saved = 0;
    try {
      const res = await ingestPayload(JSON.parse(r.raw_body));
      failures = res.failures;
      saved = res.saved;
    } catch (e) {
      failures = [e instanceof Error ? e.message : "unexpected error"];
    }
    const ok = failures.length === 0;
    await c
      .from("wa_webhook_events")
      .update({
        status: ok ? "retried" : "failed",
        error: ok ? null : failures.join("; ").slice(0, 500),
        saved,
        ...(ok ? { raw_body: null } : {}),
      })
      .eq("id", r.id);
    return ok
      ? { ok: true, message: `Done — ${saved} message${saved === 1 ? "" : "s"} saved to the inbox.` }
      : { ok: false, message: "Still failing. Check the error and try again later." };
  });
