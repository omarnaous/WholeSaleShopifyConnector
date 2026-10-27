import type { Cents } from "./catalog";

/**
 * Shopify AppSubscriptionStatus values.
 * https://shopify.dev/docs/api/admin-graphql/latest/enums/AppSubscriptionStatus
 */
export const SUBSCRIPTION_STATUSES = ["PENDING", "ACCEPTED", "ACTIVE", "DECLINED", "EXPIRED", "FROZEN", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number] | "NONE";

/** Only ACTIVE unlocks the catalog. ACCEPTED is transient (approved, not yet activated). */
export const isSubscriptionActive = (s: SubscriptionStatus | null | undefined) => s === "ACTIVE";

/**
 * What imported products should look like for a given subscription status.
 * PENDING / ACCEPTED leave products untouched (no flip-flop while the merchant is on the approval page).
 */
export function productStatusFor(s: SubscriptionStatus): "ACTIVE" | "DRAFT" | null {
  switch (s) {
    case "ACTIVE":
      return "ACTIVE";
    case "CANCELLED":
    case "DECLINED":
    case "EXPIRED":
    case "FROZEN":
    case "NONE":
      return "DRAFT";
    default:
      return null;
  }
}

/** A margin alert fires when wholesale cost has caught up with (or passed) the subscriber's own selling price. */
export const isMarginAlert = (cost: Cents, sellingPrice: Cents | null | undefined) => sellingPrice != null && cost >= sellingPrice;

export const marginPct = (cost: Cents, price: Cents) => (price <= 0 ? 0 : Math.round(((price - cost) / price) * 1000) / 10);

/**
 * The fields the platform is allowed to push after the first import.
 * Price, title, description and images are intentionally absent: they belong to the subscriber.
 */
export const SYNCED_FIELDS = ["stock", "wholesaleCost"] as const;
export type SyncedField = (typeof SYNCED_FIELDS)[number];

export function changedSyncFields(before: { stock: number; wholesaleCost: Cents }, after: { stock: number; wholesaleCost: Cents }): SyncedField[] {
  const out: SyncedField[] = [];
  if (before.stock !== after.stock) out.push("stock");
  if (before.wholesaleCost !== after.wholesaleCost) out.push("wholesaleCost");
  return out;
}

export const PLAN = {
  name: "Lumen Wholesale — Monthly",
  priceCents: 4900,
  currency: "USD",
  trialDays: 7,
  interval: "EVERY_30_DAYS" as const,
};

export const BRAND = {
  name: "LUMEN",
  legal: "Lumen Eyewear Wholesale",
  vendor: "Lumen Eyewear",
  tag: "lumen-wholesale",
  metafieldNamespace: "lumen",
};
