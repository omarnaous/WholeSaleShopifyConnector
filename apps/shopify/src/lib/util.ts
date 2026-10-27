import { useEffect, useState } from "react";

/** `gid://shopify/Product/123` → `123` */
export const numericId = (gid: string) => gid.split("/").pop() ?? gid;

/** App Bridge resolves `shopify:admin/...` hrefs to the merchant's own admin. */
export const adminProductHref = (gid: string) => `shopify:admin/products/${numericId(gid)}`;

export function toast(message: string, opts?: { isError?: boolean; duration?: number }) {
  globalThis.shopify?.toast.show(message, opts);
}

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)) : "—";

export function formatRelative(iso: string | null | undefined) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(iso);
}

export const formatPct = (pct: number) => `${pct.toFixed(1)}%`;

export type Tone = "neutral" | "info" | "success" | "caution" | "warning" | "critical";

export const LOW_STOCK = 10;
export const stockTone = (stock: number): Tone => (stock === 0 ? "critical" : stock < LOW_STOCK ? "warning" : "success");
export const stockLabel = (stock: number) => (stock === 0 ? "Out of stock" : stock < LOW_STOCK ? `Low stock · ${stock}` : `${stock} in stock`);

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
