/*
 * The signed-in user's display preferences (time zone, date format, number format, unread badge).
 * Saved in their settings on the server; the portal layout loads them on every page and the
 * formatting helpers (formatDate, formatMoney, ...) read them. A copy is kept in localStorage only
 * so the first paint uses the right format; the server is the source of truth.
 */
export type DateFormat = "DD MMM YYYY" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type NumberFormat = "indian" | "international";

export interface DisplayPrefs {
  timeZone: string;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  showUnreadBadge: boolean;
}

const KEY = "vx-display-prefs";
const DEFAULTS: DisplayPrefs = { timeZone: "Asia/Kolkata", dateFormat: "DD MMM YYYY", numberFormat: "indian", showUnreadBadge: true };

let current: DisplayPrefs = DEFAULTS;
try {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(KEY);
    if (saved) current = { ...DEFAULTS, ...JSON.parse(saved) };
  }
} catch {
  // private mode or blocked storage: defaults until the server's copy arrives
}

export function getDisplayPrefs(): DisplayPrefs {
  return current;
}

export function setDisplayPrefs(p: Partial<DisplayPrefs>): void {
  current = { ...current, ...p };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

/** From the API's settings.preferences object. */
export function applyServerPreferences(prefs: { time_zone?: string; date_format?: string; number_format?: string; show_unread_badge?: boolean } | undefined): void {
  if (!prefs) return;
  setDisplayPrefs({
    timeZone: prefs.time_zone || DEFAULTS.timeZone,
    dateFormat: (prefs.date_format as DateFormat) || DEFAULTS.dateFormat,
    numberFormat: (prefs.number_format as NumberFormat) || "indian",
    showUnreadBadge: prefs.show_unread_badge !== false,
  });
}

function parts(d: Date, timeZone?: string) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const get = (t: string) => f.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  const mon = new Intl.DateTimeFormat("en-GB", { timeZone, month: "short" }).format(d);
  return { y: get("year"), m: get("month"), d: get("day"), mon };
}

/** A calendar date ("2026-11-24") or a timestamp, in the user's date format (timestamps in their time zone). */
export function formatDatePref(value: string | Date | null | undefined): string {
  if (!value) return "—";
  let date: Date;
  let tz: string | undefined = current.timeZone;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    date = new Date(Date.UTC(y, m - 1, d));
    tz = "UTC"; // a date has no time zone
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "—";
  const p = parts(date, tz);
  switch (current.dateFormat) {
    case "DD/MM/YYYY":
      return `${p.d}/${p.m}/${p.y}`;
    case "MM/DD/YYYY":
      return `${p.m}/${p.d}/${p.y}`;
    case "YYYY-MM-DD":
      return `${p.y}-${p.m}-${p.d}`;
    default:
      return `${Number(p.d)} ${p.mon} ${p.y}`;
  }
}

/** Date and time in the user's time zone. */
export function formatDateTimePref(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: current.timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${formatDatePref(date)}, ${time}`;
}
