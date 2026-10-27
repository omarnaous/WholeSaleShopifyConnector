import { Hono, type MiddlewareHandler } from "hono";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import {
  CATALOG_FILTER_KEYS,
  PLAN,
  filterProducts,
  isMarginAlert,
  isSubscriptionActive,
  parseFilters,
  type AppCatalogProduct,
  type ImportJobState,
  type ImportedRow,
  type MarginAlertRow,
  type ShopState,
  type SubscriptionStatus,
} from "@lumen/core";
import type { AppContext, Env } from "../env";
import * as s from "../db/schema";
import { getDb, getShop, listProducts, newId } from "../db/repo";
import { exchangeForOfflineToken, verifySessionToken } from "../lib/shopify/auth";
import { clientFor, shopOrigin } from "../lib/shopify/graphql";
import { cancelSubscription, createSubscription, getShopInfo } from "../lib/shopify/operations";
import { reconcileSubscription } from "../lib/subscription";
import { enqueueImport } from "../jobs/handlers";
import { frameColorFacets } from "./public";

export const app = new Hono<AppContext>();

/**
 * Every request from the embedded app carries an App Bridge session token.
 * First request from a new (or re-installed) store performs token exchange to get the offline token.
 */
const sessionAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return c.json({ error: "Missing session token" }, 401);
  let shop: string;
  try {
    ({ shop } = await verifySessionToken(token, c.env.SHOPIFY_API_KEY, c.env.SHOPIFY_API_SECRET));
  } catch {
    return c.json({ error: "Invalid session token" }, 401, { "X-Shopify-Retry-Invalid-Session-Request": "1" });
  }
  const row = await getShop(c.env, shop);
  if (!row?.accessToken || row.uninstalledAt) await install(c.env, shop, token, row?.id);
  c.set("shop", shop);
  await next();
};

async function install(env: Env, domain: string, sessionToken: string, existingId?: string) {
  const { access_token, scope } = await exchangeForOfflineToken(domain, sessionToken, env.SHOPIFY_API_KEY, env.SHOPIFY_API_SECRET, shopOrigin(env, domain));
  const info = await getShopInfo(clientFor(env, domain, access_token));
  const db = getDb(env);
  const values = {
    accessToken: access_token,
    scope,
    uninstalledAt: null,
    currency: info.currency,
    locationId: info.location?.id ?? null,
    locationName: info.location?.name ?? null,
  };
  if (existingId) await db.update(s.shops).set(values).where(eq(s.shops.id, existingId));
  else await db.insert(s.shops).values({ id: newId("shp"), domain, ...values });
}

app.use("*", sessionAuth);

const loadShop = async (env: Env, domain: string) => (await getShop(env, domain))!;

const requireActive: MiddlewareHandler<AppContext> = async (c, next) => {
  const shop = await loadShop(c.env, c.get("shop"));
  if (!isSubscriptionActive(shop.subscriptionStatus as SubscriptionStatus)) return c.json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" }, 402);
  await next();
};

app.get("/state", async (c) => {
  let shop = await loadShop(c.env, c.get("shop"));
  shop = await reconcileSubscription(c.env, shop);
  const db = getDb(c.env);
  const [imported, alerts] = await Promise.all([
    db.$count(s.importedProducts, and(eq(s.importedProducts.shopId, shop.id), ne(s.importedProducts.status, "ORPHANED"))),
    db.$count(s.marginAlerts, and(eq(s.marginAlerts.shopId, shop.id), isNull(s.marginAlerts.resolvedAt), isNull(s.marginAlerts.dismissedAt))),
  ]);
  const body: ShopState = {
    shop: shop.domain,
    subscription: { status: shop.subscriptionStatus as SubscriptionStatus, currentPeriodEnd: shop.currentPeriodEnd, trialDays: PLAN.trialDays, test: shop.subscriptionTest },
    plan: { name: PLAN.name, price: PLAN.priceCents, currency: PLAN.currency, trialDays: PLAN.trialDays },
    importedCount: imported,
    openAlerts: alerts,
    location: shop.locationId ? { id: shop.locationId, name: shop.locationName ?? "" } : null,
  };
  return c.json(body);
});

app.post("/billing/subscribe", async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  const client = clientFor(c.env, shop.domain, shop.accessToken!);
  const store = shop.domain.replace(".myshopify.com", "");
  const result = await createSubscription(client, {
    returnUrl: `https://admin.shopify.com/store/${store}/apps/${c.env.SHOPIFY_APP_HANDLE}`,
    test: c.env.BILLING_TEST === "true",
  });
  if (result.appSubscription) await getDb(c.env).update(s.shops).set({ subscriptionId: result.appSubscription.id }).where(eq(s.shops.id, shop.id));
  return c.json({ confirmationUrl: result.confirmationUrl });
});

/** Dev-store convenience so the cancel → DRAFT → resubscribe → ACTIVE loop can be demoed from inside the app. */
app.post("/billing/cancel", async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  if (!shop.subscriptionId) return c.json({ error: "No subscription" }, 400);
  const client = clientFor(c.env, shop.domain, shop.accessToken!);
  await cancelSubscription(client, shop.subscriptionId);
  await reconcileSubscription(c.env, shop, { hint: "CANCELLED" });
  return c.json({ ok: true });
});

app.get("/catalog", requireActive, async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  const filters = parseFilters(new URL(c.req.url).searchParams);
  const [all, imported] = await Promise.all([
    listProducts(c.env),
    getDb(c.env).select().from(s.importedProducts).where(eq(s.importedProducts.shopId, shop.id)),
  ]);
  const byProduct = new Map(imported.map((i) => [i.productId, i]));
  const products: AppCatalogProduct[] = filterProducts(all, filters).map((p) => {
    const i = byProduct.get(p.id);
    return { ...p, imported: i ? { status: i.status, shopifyProductId: i.shopifyProductId, importedAt: i.importedAt } : null };
  });
  return c.json({ products, facets: { frameColors: frameColorFacets(all) }, filterKeys: CATALOG_FILTER_KEYS });
});

const importBody = z.union([z.object({ productIds: z.array(z.string()).min(1).max(500) }), z.object({ all: z.literal(true) })]);

app.post("/import", requireActive, async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  if (!shop.locationId) return c.json({ error: "No active inventory location in this store" }, 409);
  const body = importBody.parse(await c.req.json());
  const db = getDb(c.env);
  const catalog = await listProducts(c.env);
  const wanted = "all" in body ? catalog.map((p) => p.id) : body.productIds.filter((id) => catalog.some((p) => p.id === id));
  const already = new Set(
    (await db.select().from(s.importedProducts).where(and(eq(s.importedProducts.shopId, shop.id), ne(s.importedProducts.status, "ORPHANED")))).map((r) => r.productId),
  );
  const todo = wanted.filter((id) => !already.has(id));
  if (!todo.length) return c.json({ jobId: null, skipped: wanted.length });
  const jobId = await enqueueImport(c.env, shop.id, todo);
  return c.json({ jobId, skipped: wanted.length - todo.length });
});

app.get("/import/:id", async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  const job = await getDb(c.env).query.importJobs.findFirst({ where: and(eq(s.importJobs.id, c.req.param("id")), eq(s.importJobs.shopId, shop.id)) });
  if (!job) return c.json({ error: "Not found" }, 404);
  const finished = job.done + job.failed >= job.total;
  const body: ImportJobState = {
    id: job.id,
    status: finished ? (job.failed === job.total ? "failed" : "done") : job.done + job.failed > 0 ? "running" : "queued",
    total: job.total,
    done: job.done,
    failed: job.failed,
    errors: job.errors,
  };
  return c.json(body);
});

app.get("/imported", async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  const db = getDb(c.env);
  const imported = await db.select().from(s.importedProducts).where(eq(s.importedProducts.shopId, shop.id)).orderBy(desc(s.importedProducts.importedAt));
  if (!imported.length) return c.json([] satisfies ImportedRow[]);
  const products = await listProducts(c.env, { ids: imported.map((i) => i.productId), includeArchived: true });
  const ivs = await db.select().from(s.importedVariants).where(eq(s.importedVariants.shopId, shop.id));
  const rows: ImportedRow[] = imported.flatMap((i) => {
    const p = products.find((x) => x.id === i.productId);
    if (!p) return [];
    return [
      {
        productId: p.id,
        name: p.name,
        imageUrl: p.variants[0]?.imageUrl ?? null,
        shopifyProductId: i.shopifyProductId,
        status: i.status,
        lastSyncedAt: i.lastSyncedAt,
        variants: p.variants.map((v) => {
          const iv = ivs.find((x) => x.variantId === v.id && x.importedProductId === i.id);
          return {
            sku: v.sku,
            label: `${v.frameColor} / ${v.lensColor}`,
            stock: v.stock,
            cost: v.wholesaleCost,
            price: iv?.lastKnownPrice ?? null,
            marginAlert: isMarginAlert(v.wholesaleCost, iv?.lastKnownPrice),
          };
        }),
      },
    ];
  });
  return c.json(rows);
});

app.get("/alerts", async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: s.marginAlerts.id,
      cost: s.marginAlerts.cost,
      price: s.marginAlerts.price,
      createdAt: s.marginAlerts.createdAt,
      sku: s.variants.sku,
      frameColor: s.variants.frameColor,
      lensColor: s.variants.lensColor,
      productName: s.products.name,
      shopifyProductId: s.importedProducts.shopifyProductId,
    })
    .from(s.marginAlerts)
    .innerJoin(s.importedVariants, eq(s.importedVariants.id, s.marginAlerts.importedVariantId))
    .innerJoin(s.importedProducts, eq(s.importedProducts.id, s.importedVariants.importedProductId))
    .innerJoin(s.variants, eq(s.variants.id, s.importedVariants.variantId))
    .innerJoin(s.products, eq(s.products.id, s.variants.productId))
    .where(and(eq(s.marginAlerts.shopId, shop.id), isNull(s.marginAlerts.resolvedAt), isNull(s.marginAlerts.dismissedAt)))
    .orderBy(desc(s.marginAlerts.createdAt));
  const body: MarginAlertRow[] = rows.map((r) => ({
    id: r.id,
    productName: r.productName,
    sku: r.sku,
    variantLabel: `${r.frameColor} / ${r.lensColor}`,
    cost: r.cost,
    price: r.price,
    shopifyProductId: r.shopifyProductId,
    createdAt: r.createdAt,
  }));
  return c.json(body);
});

app.post("/alerts/:id/dismiss", async (c) => {
  const shop = await loadShop(c.env, c.get("shop"));
  await getDb(c.env)
    .update(s.marginAlerts)
    .set({ dismissedAt: new Date().toISOString() })
    .where(and(eq(s.marginAlerts.id, c.req.param("id")), eq(s.marginAlerts.shopId, shop.id)));
  return c.json({ ok: true });
});

