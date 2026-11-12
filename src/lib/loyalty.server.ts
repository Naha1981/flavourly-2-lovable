import { randomBytes } from "node:crypto";

import { db } from "./db.server";
import { discountCentsForPoints, haversineMeters, POINTS_BLOCK } from "./south-africa";

export const WELCOME_POINTS = 50;
const CLAIM_TTL_MS = 15 * 60 * 1000;
// Unambiguous characters only, so a waiter can read the code aloud.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const cleanPhone = (p: string) => p.replace(/\D/g, "");

export async function upsertCustomer(tenantId: string, phone: string, name?: string | null) {
  const c = await db();
  const p = cleanPhone(phone);
  const { data: existing } = await c
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("phone", p)
    .maybeSingle();
  if (existing) {
    if (name && (!existing.name || existing.name === p)) {
      await c.from("customers").update({ name }).eq("id", existing.id);
    }
    return existing as { id: string; name: string | null };
  }
  const { data, error } = await c
    .from("customers")
    .insert({ tenant_id: tenantId, phone: p, name: name ?? null })
    .select("*")
    .single();
  if (error?.code === "23505") {
    const { data: again } = await c
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("phone", p)
      .single();
    return again as { id: string; name: string | null };
  }
  if (error) throw error;
  return data as { id: string; name: string | null };
}

export async function getBalance(tenantId: string, customerId: string): Promise<number> {
  const c = await db();
  const { data, error } = await c.rpc("loyalty_balance", {
    p_tenant: tenantId,
    p_customer: customerId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function awardWelcomeBonus(tenantId: string, phone: string, name?: string | null) {
  const c = await db();
  const customer = await upsertCustomer(tenantId, phone, name);
  const { data, error } = await c.rpc("award_points", {
    p_tenant: tenantId,
    p_customer: customer.id,
    p_points: WELCOME_POINTS,
    p_reason: "welcome_bonus",
    p_key: `welcome:${customer.id}`,
    p_meta: { via: "whatsapp_join" },
  });
  if (error) throw error;
  return {
    customer,
    awarded: data === true ? WELCOME_POINTS : 0,
    balance: await getBalance(tenantId, customer.id),
  };
}

export async function recordVisit(
  tenantId: string,
  phone: string,
  spendCents: number,
  billRef: string,
) {
  const c = await db();
  const customer = await upsertCustomer(tenantId, phone);
  const { data, error } = await c.rpc("record_visit", {
    p_tenant: tenantId,
    p_customer: customer.id,
    p_spend_cents: Math.round(spendCents),
    p_bill_ref: billRef,
  });
  if (error) throw error;
  return (
    data as Array<{
      points_earned: number;
      visit_count: number;
      is_vip: boolean;
      already_recorded: boolean;
    }>
  )[0];
}

export async function createClaim(tenantId: string, phone: string, points: number) {
  if (!Number.isInteger(points) || points < POINTS_BLOCK || points % POINTS_BLOCK !== 0) {
    return {
      ok: false as const,
      error: `Redeem in blocks of ${POINTS_BLOCK} points (100 points = R10 off).`,
    };
  }
  const c = await db();
  const customer = await upsertCustomer(tenantId, phone);
  const balance = await getBalance(tenantId, customer.id);
  if (balance < points) return { ok: false as const, error: `You have ${balance} points.` };

  const token = randomBytes(16).toString("hex");
  const { error } = await c.from("reward_claims").insert({
    tenant_id: tenantId,
    customer_id: customer.id,
    token,
    points_to_burn: points,
    discount_cents: discountCentsForPoints(points),
    expires_at: new Date(Date.now() + CLAIM_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return { ok: true as const, token, discountCents: discountCentsForPoints(points) };
}

export async function getClaimPreview(token: string) {
  const c = await db();
  const { data } = await c
    .from("reward_claims")
    .select("tenant_id, discount_cents, status, expires_at, voucher_code")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const { data: t } = await c
    .from("tenant_profiles")
    .select("name, geofence_radius_m")
    .eq("tenant_id", data.tenant_id)
    .maybeSingle();
  return {
    venueName: (t?.name as string | undefined) ?? "the restaurant",
    radius: (t?.geofence_radius_m as number | undefined) ?? 500,
    discountCents: data.discount_cents as number,
    status: (data.status === "pending_gps" && new Date(data.expires_at as string) <= new Date()
      ? "expired"
      : data.status) as string,
    voucherCode: (data.voucher_code as string | null) ?? null,
  };
}

const newVoucher = () => {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
};

export async function redeemAtVenue(token: string, lat: number, lon: number) {
  const c = await db();
  const { data: claim } = await c
    .from("reward_claims")
    .select("id, tenant_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (
    !claim ||
    claim.status !== "pending_gps" ||
    new Date(claim.expires_at as string) <= new Date()
  ) {
    return { ok: false as const, error: "This reward link has expired or was already used." };
  }
  const { data: venue } = await c
    .from("tenant_profiles")
    .select("latitude, longitude, geofence_radius_m")
    .eq("tenant_id", claim.tenant_id)
    .maybeSingle();
  if (!venue?.latitude || !venue?.longitude) {
    return {
      ok: false as const,
      error: "This venue hasn't set its location yet. Please ask a team member.",
    };
  }
  const distance = haversineMeters(lat, lon, Number(venue.latitude), Number(venue.longitude));
  const radius = (venue.geofence_radius_m as number) ?? 500;
  if (distance > radius) {
    // Leave the claim pending so a guest with a bad GPS fix can retry from the table.
    return {
      ok: false as const,
      error: `You're about ${distance} m away. Rewards can only be redeemed at the restaurant (within ${radius} m).`,
    };
  }
  const { data, error } = await c.rpc("redeem_claim", {
    p_token: token,
    p_voucher: newVoucher(),
    p_lat: lat,
    p_lon: lon,
    p_distance: distance,
  });
  if (error) {
    const msg = error.message.includes("insufficient_points")
      ? "Your points balance changed. Please request a new reward."
      : "This reward link has expired or was already used.";
    return { ok: false as const, error: msg };
  }
  const row = (data as Array<{ voucher_code: string; discount_cents: number }>)[0]!;
  return {
    ok: true as const,
    voucherCode: row.voucher_code,
    discountCents: row.discount_cents,
    distance,
  };
}
