/**
 * POPIA-friendly send window: automated marketing/outbound may only go out
 * 07:00–20:00 South African time. South Africa has no DST, so SAST is a fixed
 * UTC+2 and we can do the maths without locale/timezone parsing.
 * Inbound replies to a guest who just wrote to us are NOT automated and are exempt.
 */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
export const SEND_WINDOW_START_HOUR = 7;
export const SEND_WINDOW_END_HOUR = 20; // exclusive: 19:59:59 is the last allowed second

const toSast = (d: Date) => new Date(d.getTime() + SAST_OFFSET_MS);

export function sastHour(d: Date = new Date()): number {
  return toSast(d).getUTCHours();
}

export function isWithinSendWindow(d: Date = new Date()): boolean {
  const h = sastHour(d);
  return h >= SEND_WINDOW_START_HOUR && h < SEND_WINDOW_END_HOUR;
}

/** `d` itself when inside the window, otherwise the next 07:00 SAST. */
export function nextSendWindowStart(d: Date = new Date()): Date {
  if (isWithinSendWindow(d)) return d;
  const s = toSast(d);
  const dayOffset = s.getUTCHours() >= SEND_WINDOW_END_HOUR ? 1 : 0;
  const startUtc = Date.UTC(
    s.getUTCFullYear(),
    s.getUTCMonth(),
    s.getUTCDate() + dayOffset,
    SEND_WINDOW_START_HOUR,
    0,
    0,
  );
  return new Date(startUtc - SAST_OFFSET_MS);
}

/** Today's date in SAST as YYYY-MM-DD. */
export function sastDateString(d: Date = new Date()): string {
  return toSast(d).toISOString().slice(0, 10);
}

/** Today's month-day in SAST as MM-DD (used for birthday matching). */
export function sastMonthDay(d: Date = new Date()): string {
  return toSast(d).toISOString().slice(5, 10);
}
