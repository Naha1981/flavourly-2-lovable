/** Rand formatting and geofence maths shared by server and UI. */

export function formatZAR(cents: number): string {
  const total = Math.round(cents);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  const rands = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const c = abs % 100;
  return `${sign}R${rands}${c ? `.${String(c).padStart(2, "0")}` : ""}`;
}

/** Great-circle distance in whole metres. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** R1 = 1 point (whole rands only). */
export const pointsForSpend = (spendCents: number) => Math.max(0, Math.floor(spendCents / 100));

/** 100 points = R10 off. */
export const POINTS_BLOCK = 100;
export const discountCentsForPoints = (points: number) => (points / POINTS_BLOCK) * 1000;
