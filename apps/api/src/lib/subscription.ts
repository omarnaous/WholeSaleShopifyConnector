import { eq } from "drizzle-orm";
import { productStatusFor, type SubscriptionStatus } from "@lumen/core";
import type { Env } from "../env";
import * as s from "../db/schema";
import { getDb } from "../db/repo";
import { enqueueStatusForShop } from "../jobs/handlers";
import { clientFor } from "./shopify/graphql";
import { getActiveSubscription } from "./shopify/operations";

type ShopRow = typeof s.shops.$inferSelect;

/**
 * Source of truth for billing is Shopify itself, not the webhook payload:
 * webhooks can arrive late, duplicated or out of order (e.g. the old plan's CANCELLED after the new plan's ACTIVE).
 * So every trigger (webhook, app load, cron) re-reads currentAppInstallation and reconciles.
 */
export async function reconcileSubscription(env: Env, shop: ShopRow, opts: { force?: boolean; hint?: SubscriptionStatus } = {}) {
  if (!shop.accessToken || shop.uninstalledAt) return shop;
  const client = clientFor(env, shop.domain, shop.accessToken);
  const active = await getActiveSubscription(client);
  // activeSubscriptions only lists live plans; for the inactive reason (FROZEN vs CANCELLED…) trust the webhook hint.
  const inactive: SubscriptionStatus = opts.hint && opts.hint !== "ACTIVE" ? opts.hint : shop.subscriptionId ? "CANCELLED" : "NONE";
  const status: SubscriptionStatus = (active?.status as SubscriptionStatus) ?? inactive;
  return applySubscriptionStatus(env, shop, {
    status,
    id: active?.id ?? shop.subscriptionId,
    test: active?.test ?? shop.subscriptionTest,
    currentPeriodEnd: active?.currentPeriodEnd ?? null,
  }, opts);
}

export async function applySubscriptionStatus(
  env: Env,
  shop: ShopRow,
  sub: { status: SubscriptionStatus; id: string | null; test: boolean; currentPeriodEnd: string | null },
  opts: { force?: boolean } = {},
) {
  const db = getDb(env);
  const changed = shop.subscriptionStatus !== sub.status;
  await db
    .update(s.shops)
    .set({ subscriptionStatus: sub.status, subscriptionId: sub.id, subscriptionTest: sub.test, currentPeriodEnd: sub.currentPeriodEnd })
    .where(eq(s.shops.id, shop.id));
  const target = productStatusFor(sub.status);
  // On a real change (or a forced cron reconcile). enqueueStatusForShop skips products already in the target state.
  if (target && (changed || opts.force)) await enqueueStatusForShop(env, shop.id, target);
  return { ...shop, subscriptionStatus: sub.status, subscriptionId: sub.id, subscriptionTest: sub.test, currentPeriodEnd: sub.currentPeriodEnd };
}
