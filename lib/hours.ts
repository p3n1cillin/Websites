import type { OpeningHour } from "./types";

/**
 * Live open/closed logic for a business (Phase 5 — live data). Pure + deterministic
 * so it runs identically on server and client; the LIVE behaviour comes from the
 * client passing the current `Date` (a static SSG page can't know "now"). Zero deps.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface OpenState {
  open: boolean;
  /** Short status line, e.g. "Open now · closes 18:00" or "Closed · opens Mon 08:00". */
  label: string;
}

/** Match an opening-hours entry to a weekday index (full or short day names). */
function entryForDay(hours: OpeningHour[], dayIndex: number): OpeningHour | undefined {
  const full = DAY_NAMES[dayIndex].toLowerCase();
  const short = DAY_SHORT[dayIndex].toLowerCase();
  return hours.find((h) => {
    const d = h.day.trim().toLowerCase();
    return d === full || d === short || d.startsWith(short);
  });
}

/** Parse "08:00 – 18:00" (any dash) → [openMins, closeMins], or null when closed/unparseable. */
function parseRange(hours: string): [number, number] | null {
  if (/closed/i.test(hours)) return null;
  const m = hours.match(/(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const open = Number(m[1]) * 60 + Number(m[2]);
  const close = Number(m[3]) * 60 + Number(m[4]);
  return close > open ? [open, close] : null;
}

const fmt = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Compute live open/closed status for `now`. Returns null when hours are unusable. */
export function computeOpenState(hours: OpeningHour[], now: Date): OpenState | null {
  if (!hours || hours.length === 0) return null;
  const dayIndex = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const today = entryForDay(hours, dayIndex);
  const range = today ? parseRange(today.hours) : null;

  if (range) {
    const [open, close] = range;
    if (nowMins >= open && nowMins < close) {
      return { open: true, label: `Open now · closes ${fmt(close)}` };
    }
    if (nowMins < open) {
      return { open: false, label: `Closed · opens ${fmt(open)}` };
    }
  }

  // Closed now → find the next day with a parseable range.
  for (let i = 1; i <= 7; i++) {
    const idx = (dayIndex + i) % 7;
    const r = entryForDay(hours, idx) ? parseRange(entryForDay(hours, idx)!.hours) : null;
    if (r) {
      const when = i === 1 ? "tomorrow" : DAY_SHORT[idx];
      return { open: false, label: `Closed · opens ${when} ${fmt(r[0])}` };
    }
  }
  return { open: false, label: "Closed" };
}
