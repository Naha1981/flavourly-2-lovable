import { db } from "./db.server";
import { enqueueOutbox } from "./outbox.server";

const BIRTHDAY_WINDOW_DAYS = 7;
const AT_RISK_MIN_DAYS = 120;
const DORMANT_MIN_DAYS = 180;

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function birthdayTarget(birthday: string, now: Date): { days: number; year: number } | null {
  if (!/^\d{2}-\d{2}$/.test(birthday)) return null;
  const [month, day] = birthday.split("-").map(Number);
  const safeMonth = month ?? 0;
  const safeDay = day ?? 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let year = now.getFullYear();
  let target = new Date(year, safeMonth - 1, safeDay);
  if (target < today) {
    year += 1;
    target = new Date(year, safeMonth - 1, safeDay);
  }
  const days = daysBetween(today, target);
  return days >= 0 && days <= BIRTHDAY_WINDOW_DAYS ? { days, year } : null;
}

function birthdayDays(birthday: string, now: Date): number | null {
  return birthdayTarget(birthday, now)?.days ?? null;
}

function birthdayText(name: string | null, days: number, restaurant: string) {
  const who = name?.trim() || "there";
  const when = days === 0 ? "today" : "in " + days + (days === 1 ? " day" : " days");
  return `🎂 Hi ${who}, your birthday is ${when}! We'd love to celebrate with you at ${restaurant}. We'll add a complimentary dessert to your birthday booking. Reply BOOK and we'll help you choose a table.`;
}

function reactivationText(name: string | null, restaurant: string, segment: "at_risk" | "dormant") {
  const who = name?.trim() || "there";
  if (segment === "dormant") {
    return `Hi ${who}, we've missed you at ${restaurant}! We've added new dishes since your last visit. Come back this weekend and enjoy 10% off. Reply BOOK to reserve.`;
  }
  return `Hi ${who}, it's been a while since your last visit at ${restaurant}. We'd love to see you again. Reply BOOK and we'll find you a table.`;
}

async function processTenant(
  tenantId: string,
  restaurantName: string,
  now: Date,
): Promise<{ birthdays: number; reactivations: number; approvals: number; queued: number }> {
  const c = await db();
  const { data: customers } = await c.from("customers")
    .select("id, phone, name, birthday, last_visit_at, last_birthday_reward_sent_at, last_reactivation_sent_at")
    .eq("tenant_id", tenantId)
    .limit(5000);

  let birthdays = 0;
  let reactivations = 0;
  let approvals = 0;
  let queued = 0;

  for (const customer of customers ?? []) {
    const phone = String(customer.phone ?? "").replace(/\D/g, "");
    if (!phone) continue;

    const birthdayInfo = typeof customer.birthday === "string" ? birthdayTarget(customer.birthday, now) : null;
    const birthday = birthdayInfo?.days ?? null;
    const lastBirthday = customer.last_birthday_reward_sent_at ? new Date(customer.last_birthday_reward_sent_at) : null;
    const birthdayNotRecentlySent = !lastBirthday || lastBirthday.getFullYear() !== birthdayInfo?.year;

    if (birthday !== null && birthdayNotRecentlySent) {
      const result = await enqueueOutbox({
        tenantId,
        phone,
        text: birthdayText(customer.name, birthday, restaurantName),
        automated: true,
        dedupeKey: "birthday:" + tenantId + ":" + customer.id + ":" + now.getFullYear(),
      });
      if (result.approvalRequired) approvals += 1;
      if (result.queued || result.approvalRequired) {
        birthdays += 1;
        await c.from("customers").update({ last_birthday_reward_sent_at: now.toISOString() })
          .eq("tenant_id", tenantId).eq("id", customer.id);
      }
      if (result.queued) queued += 1;
      continue;
    }

    if (!customer.last_visit_at) continue;
    const lastVisit = new Date(customer.last_visit_at);
    const days = daysBetween(lastVisit, now);
    if (days <= AT_RISK_MIN_DAYS) continue;

    const segment = days >= DORMANT_MIN_DAYS ? "dormant" : "at_risk";
    const lastReact = customer.last_reactivation_sent_at ? new Date(customer.last_reactivation_sent_at) : null;
    if (lastReact && daysBetween(lastReact, now) < 90) continue;

    const result = await enqueueOutbox({
      tenantId,
      phone,
      text: reactivationText(customer.name, restaurantName, segment),
      automated: true,
      dedupeKey: "reactivation:" + tenantId + ":" + customer.id + ":" + Math.floor(now.getTime() / (90 * 86_400_000)),
    });
    if (result.approvalRequired) approvals += 1;
    if (result.queued || result.approvalRequired) {
      reactivations += 1;
      await c.from("customers").update({ last_reactivation_sent_at: now.toISOString() })
        .eq("tenant_id", tenantId).eq("id", customer.id);
    }
    if (result.queued) queued += 1;
  }

  return { birthdays, reactivations, approvals, queued };
}

export async function runCustomerLifecycle() {
  const c = await db();
  const { data: tenants } = await c.from("tenant_profiles").select("tenant_id, name").limit(100);
  const totals = { tenants: 0, birthdays: 0, reactivations: 0, approvals: 0, queued: 0 };
  const now = new Date();

  for (const tenant of tenants ?? []) {
    const result = await processTenant(String(tenant.tenant_id), String(tenant.name ?? tenant.tenant_id), now);
    totals.tenants += 1;
    totals.birthdays += result.birthdays;
    totals.reactivations += result.reactivations;
    totals.approvals += result.approvals;
    totals.queued += result.queued;
  }
  return totals;
}
