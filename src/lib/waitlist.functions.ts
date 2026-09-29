import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

export type WaitlistEntry = {
  id: string;
  customerName: string | null;
  customerPhone: string;
  partySize: number;
  requestedDate: string;
  status: string;
  offerExpiresAt: string | null;
  createdAt: string;
};

export const listWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant }).parse(d))
  .handler(async ({ data }): Promise<WaitlistEntry[]> => {
    const { authorizeTenant } = await import("./tenant-auth.server");
    await authorizeTenant(data.tenantId);
    const { db } = await import("./db.server");
    const c = await db();
    const { data: rows } = await c
      .from("waitlist_entries")
      .select("*")
      .eq("tenant_id", data.tenantId)
      .in("status", ["waiting", "offered"])
      .order("requested_date", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(200);
    return (rows ?? []).map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      partySize: r.party_size,
      requestedDate: r.requested_date,
      status: r.status,
      offerExpiresAt: r.offer_expires_at,
      createdAt: r.created_at,
    }));
  });
