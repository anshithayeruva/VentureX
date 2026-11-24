import { formatDatePref, getDisplayPrefs } from "@/lib/displayPrefs";

/** "₹75,000", "₹7.5 L", "₹1.2 Cr" — compact rupees for amounts people skim. With the international
 *  number format: "₹75,000", "₹750K", "₹12M". */
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  if (getDisplayPrefs().numberFormat === "international") {
    if (abs >= 1_000_000_000) return `${sign}₹${trim(abs / 1_000_000_000)}B`;
    if (abs >= 1_000_000) return `${sign}₹${trim(abs / 1_000_000)}M`;
    if (abs >= 100_000) return `${sign}₹${trim(abs / 1_000)}K`;
    return `${sign}₹${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  if (abs >= 10_000_000) return `${sign}₹${trim(abs / 10_000_000)} Cr`;
  if (abs >= 100_000) return `${sign}₹${trim(abs / 100_000)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function timeAgo(value: string | number | Date): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDatePref(new Date(then));
}
