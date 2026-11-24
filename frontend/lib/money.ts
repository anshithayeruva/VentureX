/*
 * Money from the API is a decimal string ("125000.00"). Totals are computed on the server with
 * exact decimals; the browser only formats them (and parses for chart geometry).
 */
import { formatDatePref, getDisplayPrefs } from "@/lib/displayPrefs";
import { formatMoney } from "@/lib/format";

// Indian grouping (₹1,20,000.50) or international (₹120,000.50), per the user's number format.
const inrIndian = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const inrIntl = new Intl.NumberFormat("en-US", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const inr = { format: (n: number) => (getDisplayPrefs().numberFormat === "international" ? inrIntl : inrIndian).format(n) };

export function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** "₹1,25,000.00" — exact, for tables and ledgers. */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return inr.format(toNumber(value));
}

/** "₹1.5 Cr" — compact, for headline numbers. */
export function formatCompact(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = toNumber(value);
  if (Math.abs(n) >= 100_000 || Number.isInteger(n)) return formatMoney(n);
  return inr.format(n); // small amounts with paise: "₹1,200.50", never "₹1,200.5"
}

/** Axis ticks: one consistent unit ("₹25K", "₹5 L", "₹1.5 Cr"). */
export function formatAxis(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(Math.round(n * 100) / 100);
  if (abs >= 10_000_000) return `₹${trim(value / 10_000_000)} Cr`;
  if (abs >= 100_000) return `₹${trim(value / 100_000)} L`;
  if (abs >= 1_000) return `₹${trim(value / 1_000)}K`;
  return `₹${Math.round(value)}`;
}

/** "+₹12,000" / "−₹3.5 L" for gains and losses. */
export function formatSigned(value: string | number | null | undefined, exact = false): string {
  if (value == null || value === "") return "—";
  const n = toNumber(value);
  const body = exact ? inr.format(Math.abs(n)) : formatCompact(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

export function gainTone(value: string | number | null | undefined): "positive" | "danger" | "neutral" {
  const n = toNumber(value);
  return n > 0 ? "positive" : n < 0 ? "danger" : "neutral";
}

/** A positive amount with at most 2 decimals, as typed into a form ("1,25,000.5" is accepted). */
export function cleanMoneyInput(raw: string): string | null {
  const text = raw.replace(/[,\s₹$]/g, "");
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(text)) return null;
  return text;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A calendar date in the user's date format. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return formatDatePref(value.slice(0, 10));
}
