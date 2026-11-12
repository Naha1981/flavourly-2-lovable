import { sastDateString } from "@/lib/whatsapp/quiet-hours";

/**
 * Deterministic extraction of booking details from a WhatsApp message.
 * No AI involved: anything we can't parse is asked for explicitly.
 */
export type BookingIntent = {
  partySize?: number;
  date?: string; // YYYY-MM-DD (SAST)
  time?: string; // HH:mm 24h
  name?: string;
  isConfirm: boolean;
  isCancel: boolean;
};

const CONFIRM =
  /^(yes|yep|yeah|yup|confirm|confirmed|book it|please do|sure|ok|okay|sounds good|perfect)[\s.!]*$/i;
const CANCEL = /^(cancel|stop|no thanks|no thank you|never ?mind|no)[\s.!]*$/i;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDate(text: string, now: Date): string | undefined {
  const t = text.toLowerCase();
  const today = sastDateString(now);

  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  if (/\b(today|tonight)\b/.test(t)) return today;
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);

  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < 7; i++) {
    const name = WEEKDAYS[i]!;
    if (new RegExp(`\\b${name}\\b|\\b${name.slice(0, 3)}\\b`).test(t)) {
      let diff = (i - dow + 7) % 7;
      if (diff === 0 && /\bnext\b/.test(t)) diff = 7;
      return addDays(today, diff);
    }
  }

  const year = Number(today.slice(0, 4));
  const monthAlt = MONTHS.join("|");
  const dm = t.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthAlt})[a-z]*\\b`),
  );
  const md = t.match(new RegExp(`\\b(${monthAlt})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  const parts = dm
    ? { day: Number(dm[1]), mon: MONTHS.indexOf(dm[2]!) }
    : md
      ? { day: Number(md[2]), mon: MONTHS.indexOf(md[1]!) }
      : null;
  if (parts && parts.day >= 1 && parts.day <= 31) {
    let candidate = `${year}-${pad(parts.mon + 1)}-${pad(parts.day)}`;
    if (candidate < today) candidate = `${year + 1}-${pad(parts.mon + 1)}-${pad(parts.day)}`;
    if (!Number.isNaN(Date.parse(candidate))) return candidate;
  }
  return undefined;
}

export function parseTime(text: string): string | undefined {
  const t = text.toLowerCase();
  let h: number | undefined;
  let m = 0;

  const withMinutes = t.match(/\b(\d{1,2})[:h.](\d{2})\s*(am|pm)?\b/);
  const meridiem = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  const atHour = t.match(/\bat\s+(\d{1,2})\b(?!\s*(?:people|guests|pax|persons|covers))/);

  if (withMinutes) {
    h = Number(withMinutes[1]);
    m = Number(withMinutes[2]);
    if (withMinutes[3] === "pm" && h < 12) h += 12;
    if (withMinutes[3] === "am" && h === 12) h = 0;
  } else if (meridiem) {
    h = Number(meridiem[1]);
    if (meridiem[2] === "pm" && h < 12) h += 12;
    if (meridiem[2] === "am" && h === 12) h = 0;
  } else if (atHour) {
    h = Number(atHour[1]);
    if (h >= 1 && h <= 11) h += 12; // "at 8" for a restaurant means 20:00
  }
  if (h === undefined || h > 23 || m > 59) return undefined;
  return `${pad(h)}:${pad(m)}`;
}

export function parsePartySize(text: string): number | undefined {
  const t = text.toLowerCase();
  const patterns = [
    /\b(?:table|party|booking|book|reservation|seats?)\s+(?:for|of)\s+(\d{1,2})\b(?!\s*(?::|h\d|am|pm))/,
    /\bfor\s+(\d{1,2})\s*(?:people|persons|guests|pax|covers|of us|adults)\b/,
    /\b(\d{1,2})\s*(?:people|persons|guests|pax|covers|of us|adults)\b/,
    /\bwe(?:'| a)?re\s+(\d{1,2})\b(?!\s*(?::|am|pm))/,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 50) return n;
    }
  }
  return undefined;
}

const NAME_STOP = new Set([
  "for",
  "at",
  "on",
  "in",
  "tomorrow",
  "today",
  "tonight",
  "please",
  "and",
  "with",
  "pls",
  "thanks",
]);

export function parseName(text: string): string | undefined {
  const m = text.match(
    /\b(?:under(?: the name)?|my name is|name is|name's|it'?s for)\s+([A-Za-z][A-Za-z'-]{1,20})(?:\s+([A-Za-z][A-Za-z'-]{0,20}))?/i,
  );
  if (!m) return undefined;
  const parts = [m[1]!];
  if (m[2] && !NAME_STOP.has(m[2].toLowerCase())) parts.push(m[2]);
  if (NAME_STOP.has(parts[0]!.toLowerCase())) return undefined;
  return parts.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseBookingText(text: string, now: Date = new Date()): BookingIntent {
  const trimmed = text.trim();
  if (CONFIRM.test(trimmed)) return { isConfirm: true, isCancel: false };
  if (CANCEL.test(trimmed)) return { isConfirm: false, isCancel: true };
  const partySize = parsePartySize(trimmed);
  const date = parseDate(trimmed, now);
  const time = parseTime(trimmed);
  const name = parseName(trimmed);
  return {
    isConfirm: false,
    isCancel: false,
    ...(partySize !== undefined ? { partySize } : {}),
    ...(date ? { date } : {}),
    ...(time ? { time } : {}),
    ...(name ? { name } : {}),
  };
}

/** True when the text looks like the start of a booking request. */
export const hasBookingSignal = (i: BookingIntent, raw: string) =>
  i.partySize !== undefined ||
  i.date !== undefined ||
  i.time !== undefined ||
  /\b(book|booking|reserve|reservation|table)\b/i.test(raw);

export function prettyDay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export const prettyWhen = (date: string, time: string) => `${prettyDay(date)} at ${time}`;
