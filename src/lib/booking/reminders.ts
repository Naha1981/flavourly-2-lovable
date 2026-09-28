/** Reminder ladder: 48h, 24h and 6h before the booking. Pure so it can be tested. */
export const TIERS = [48, 24, 6] as const;
export type Tier = (typeof TIERS)[number];

const HOUR = 3_600_000;

/** Reservation date + time are SAST (UTC+2, no DST). */
export function reservationStart(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, hh!, mm ?? 0) - 2 * HOUR);
}

/**
 * The single tier to send right now, or null. Only the closest due tier is sent
 * (no burst of 48h+24h+6h after a cron outage), and a tier is skipped if the
 * booking was made after that tier's moment (booked 5h ahead gets no 48h reminder).
 */
export function dueTier(start: Date, createdAt: Date, now: Date): Tier | null {
  if (now >= start) return null;
  for (const tier of [...TIERS].reverse()) {
    const at = new Date(start.getTime() - tier * HOUR);
    if (now >= at) return createdAt <= at ? tier : null;
  }
  return null;
}

export function reminderText(
  tier: Tier,
  guest: string,
  venue: string,
  whenLabel: string,
  party: number,
): string {
  const first = guest.split(" ")[0] || "there";
  const lead =
    tier === 6
      ? "See you later today"
      : tier === 24
        ? "See you tomorrow"
        : "Your table is coming up";
  return `Hi ${first}, ${lead} at ${venue}: table for ${party}, ${whenLabel}.\n\nReply *YES* to confirm you're coming, or *CANCEL* if your plans have changed so we can offer the table to someone else.`;
}
