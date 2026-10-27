import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { isSubscriptionActive, type SubscriptionStatus } from "@lumen/core";
import type { AppContext, Env } from "../env";
import * as s from "../db/schema";
import { getDb, getShop } from "../db/repo";
import { verifyWebhookHmac } from "../lib/shopify/auth";
import { toCents } from "../lib/shopify/operations";
import { reconcileSubscription } from "../lib/subscription";
import { enqueueStatusForShop, evaluateMarginAlerts } from "../jobs/handlers";

export const webhooks = new Hono<AppContext>();

/**
 * Single endpoint for all topics (configured in shopify.app.toml).
 * Responds fast; heavy work is pushed to the queue.
 */
webhooks.post("/shopify", async (c) => {
  const raw = await c.req.arrayBuffer();
  if (!(await verifyWebhookHmac(raw, c.req.header("x-shopify-hmac-sha256") ?? null, c.env.SHOPIFY_API_SECRET))) return c.text("Unauthorized", 401);

  const topic = c.req.header("x-shopify-topic") ?? "";
  const domain = c.req.header("x-shopify-shop-domain") ?? "";
  const webhookId = c.req.header("x-shopify-webhook-id") ?? crypto.randomUUID();
  const payload = JSON.parse(new TextDecoder().decode(raw));
  const db = getDb(c.env);

  // Shopify retries and occasionally duplicates deliveries → dedupe on webhook id.
  const inserted = await db.insert(s.webhookEvents).values({ id: webhookId, shop: domain, topic }).onConflictDoNothing().returning();
  if (!inserted.length) return c.text("duplicate", 200);

  c.executionCtx.waitUntil(
    handle(c.env, topic, domain, payload).catch((e) => console.error(`webhook ${topic} for ${domain} failed`, e)),
  );
  return c.text("ok", 200);
});

async function handle(env: Env, topic: string, domain: string, payload: any) {
  const db = getDb(env);
  const shop = await getShop(env, domain);

  switch (topic) {
    case "app_subscriptions/update": {
      if (!shop) return;
      const status = String(payload?.app_subscription?.status ?? "").toUpperCase() as SubscriptionStatus;
      await reconcileSubscription(env, shop, { hint: status });
      return;
    }

    case "app/uninstalled": {
      if (!shop) return;
      // The token is already revoked: we cannot draft products anymore. See docs/ARCHITECTURE.md → "Uninstall gap".
      await db
        .update(s.shops)
        .set({ accessToken: null, uninstalledAt: new Date().toISOString(), subscriptionStatus: "NONE" })
        .where(eq(s.shops.id, shop.id));
      return;
    }

    case "products/update": {
      if (!shop) return;
      const productGid: string = payload.admin_graphql_api_id;
      const imported = await db.query.importedProducts.findFirst({ where: and(eq(s.importedProducts.shopId, shop.id), eq(s.importedProducts.shopifyProductId, productGid)) });
      if (!imported) return;

      // Track subscriber's selling price → margin alerts.
      const prices = new Map<string, number>((payload.variants ?? []).map((v: any) => [v.admin_graphql_api_id, toCents(v.price)]));
      const ivs = await db.select().from(s.importedVariants).where(eq(s.importedVariants.importedProductId, imported.id));
      const variantRows = ivs.length ? await db.select().from(s.variants).where(inArray(s.variants.id, ivs.map((i) => i.variantId))) : [];
      const costOf = new Map(variantRows.map((v) => [v.id, v.wholesaleCost]));
      const stmts: any[] = [];
      for (const iv of ivs) {
        const p = prices.get(iv.shopifyVariantId);
        if (p !== undefined && p !== iv.lastKnownPrice) stmts.push(db.update(s.importedVariants).set({ lastKnownPrice: p }).where(eq(s.importedVariants.id, iv.id)));
      }
      if (stmts.length) await db.batch(stmts as [any, ...any[]]);
      await evaluateMarginAlerts(
        db,
        shop.id,
        ivs.map((iv) => ({ importedVariantId: iv.id, cost: costOf.get(iv.variantId) ?? 0, price: prices.get(iv.shopifyVariantId) ?? iv.lastKnownPrice })),
      );

      // Enforcement: a store without an active plan cannot re-publish our products by hand.
      const liveStatus = String(payload.status ?? "").toUpperCase();
      if (liveStatus === "ACTIVE" && !isSubscriptionActive(shop.subscriptionStatus as SubscriptionStatus)) {
        await db.update(s.importedProducts).set({ status: "ACTIVE" }).where(eq(s.importedProducts.id, imported.id));
        await enqueueStatusForShop(env, shop.id, "DRAFT");
      }
      return;
    }

    case "products/delete": {
      if (!shop) return;
      const gid = `gid://shopify/Product/${payload.id}`;
      await db
        .update(s.importedProducts)
        .set({ status: "ORPHANED" })
        .where(and(eq(s.importedProducts.shopId, shop.id), eq(s.importedProducts.shopifyProductId, gid)));
      return;
    }

    // Mandatory compliance webhooks. We store no customer data, so data_request / redact are no-ops.
    case "customers/data_request":
    case "customers/redact":
      return;
    case "shop/redact": {
      if (shop) await db.delete(s.shops).where(eq(s.shops.id, shop.id)); // cascades to imports
      return;
    }
  }
}
