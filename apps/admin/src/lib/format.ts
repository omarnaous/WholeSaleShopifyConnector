import { formatMoney } from "@lumen/core";

export const money = (cents: number) => formatMoney(cents);

/** Always two decimals: for tables where columns should line up. */
export const money2 = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);

export const centsToDollars = (cents: number) => (cents / 100).toFixed(2);

/** "12.5" → 1250. Returns null for blank / invalid / negative input. */
export function dollarsToCents(v: string): number | null {
  const t = v.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!t || !/^\d*(\.\d{0,2})?$/.test(t)) return null;
  const n = Math.round(Number.parseFloat(t) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function moneyRange(a: number, b: number) {
  return a === b ? money(a) : `${money(a)}–${money(b)}`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

export function timeAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return dateShort(iso);
}

export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const dateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })
    : "—";

export function duration(from: string, to: string | null) {
  if (!to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60000)} min`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const syncedMsg = (n: number) => (n > 0 ? `synced to ${plural(n, "store")}` : "no stores to sync");

export const LOW_STOCK = 10;
