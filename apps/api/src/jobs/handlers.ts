import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { isMarginAlert, isSubscriptionActive, productStatusFor, type SubscriptionStatus, type SyncedField } from "@lumen/core";
import type { Env } from "../env";
import * as s from "../db/schema";
import { getDb, getProduct, getShopById, newId, nowIso, chunks, type DB } from "../db/repo";
import { clientFor, ShopifyAuthError } from "../lib/shopify/graphql";
import { getVariantPrices, importProduct, setProductStatus, setStock, updateCosts } from "../lib/shopify/operations";
import type { JobMessage } from "./messages";

/** Non-retryable failure: the job is marked failed and the message acked. */
class PermanentError extends Error {}

export async function handleJob(env: Env, msg: JobMessage, attempt: number) {
  const db = getDb(env);
  await db.update(s.syncJobs).set({ status: "running", attempts: attempt }).where(eq(s.syncJobs.id, msg.jobId));
  try {
    if (msg.type === "import") await runImport(env, db, msg);
    else if (msg.type === "sync") await runSync(env, db, msg);
    else await runStatus(env, db, msg);
    await db.update(s.syncJobs).set({ status: "done", error: null, finishedAt: nowIso() }).where(eq(s.syncJobs.id, msg.jobId));
    return "ack" as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const permanent = err instanceof PermanentError || err instanceof ShopifyAuthError || attempt >= 5;
    await db
      .update(s.syncJobs)
      .set({ status: permanent ? "failed" : "queued", error: message, finishedAt: permanent ? nowIso() : null })
      .where(eq(s.syncJobs.id, msg.jobId));
    if (permanent && msg.type === "import") await bumpImportJob(db, msg.importJobId, "failed", { productId: msg.productId, message });
    return permanent ? ("ack" as const) : ("retry" as const);
  }
}

async function shopClient(env: Env, shopId: string) {
  const shop = await getShopById(env, shopId);
  if (!shop?.accessToken || shop.uninstalledAt) throw new PermanentError("Store is not connected");
  return { shop, client: clientFor(env, shop.domain, shop.accessToken) };
}

// ── import ───────────────────────────────────────────────────────────────────

async function runImport(env: Env, db: DB, msg: Extract<JobMessage, { type: "import" }>) {
  const { shop, client } = await shopClient(env, msg.shopId);
  if (!isSubscriptionActive(shop.subscriptionStatus as SubscriptionStatus)) throw new PermanentError("Subscription is not active");
  if (!shop.locationId) throw new PermanentError("No inventory location configured");

  const already = await db.query.importedProducts.findFirst({
    where: and(eq(s.importedProducts.shopId, shop.id), eq(s.importedProducts.productId, msg.productId)),
  });
  // Idempotent: a retried message after a successful productSet must not create a duplicate.
  if (already && already.status !== "ORPHANED") {
    await bumpImportJob(db, msg.importJobId, "done");
    return;
  }

  const product = await getProduct(env, msg.productId);
  if (!product || product.status !== "active") throw new PermanentError("Product is no longer available");

  const result = await importProduct(client, product, { locationId: shop.locationId, imageUrl: (u) => u, status: "ACTIVE" });

  const importedId = already?.id ?? newId("imp");
  const bySku = new Map(result.variants.map((v) => [v.sku, v]));
  const stmts: any[] = [];
  if (already) {
    stmts.push(
      db.update(s.importedProducts).set({ shopifyProductId: result.productId, status: "ACTIVE", importedAt: nowIso(), lastSyncedAt: nowIso() }).where(eq(s.importedProducts.id, already.id)),
      db.delete(s.importedVariants).where(eq(s.importedVariants.importedProductId, already.id)),
    );
  } else {
    stmts.push(
      db.insert(s.importedProducts).values({ id: importedId, shopId: shop.id, productId: product.id, shopifyProductId: result.productId, status: "ACTIVE", lastSyncedAt: nowIso() }),
    );
  }
  for (const v of product.variants) {
    const sv = bySku.get(v.sku);
    if (!sv) continue;
    stmts.push(
      db.insert(s.importedVariants).values({
        id: newId("ipv"),
        importedProductId: importedId,
        shopId: shop.id,
        variantId: v.id,
        shopifyVariantId: sv.id,
        inventoryItemId: sv.inventoryItemId,
        lastKnownPrice: Math.round(Number(sv.price) * 100),
        lastSyncedCost: v.wholesaleCost,
        lastSyncedStock: v.stock,
      }),
    );
  }
  await db.batch(stmts as [any, ...any[]]);
  await bumpImportJob(db, msg.importJobId, "done");
}

async function bumpImportJob(db: DB, importJobId: string, kind: "done" | "failed", error?: { productId: string; message: string }) {
  if (kind === "done") await db.update(s.importJobs).set({ done: sql`${s.importJobs.done} + 1` }).where(eq(s.importJobs.id, importJobId));
  else
    await db
      .update(s.importJobs)
      .set({ failed: sql`${s.importJobs.failed} + 1`, errors: sql`json_insert(${s.importJobs.errors}, '$[#]', json(${JSON.stringify(error)}))` })
      .where(eq(s.importJobs.id, importJobId));
}

// ── sync ─────────────────────────────────────────────────────────────────────

async function runSync(env: Env, db: DB, msg: Extract<JobMessage, { type: "sync" }>) {
  const { shop, client } = await shopClient(env, msg.shopId);
  const imported = await db.query.importedProducts.findFirst({
    where: and(eq(s.importedProducts.shopId, shop.id), eq(s.importedProducts.productId, msg.productId)),
  });
  if (!imported || imported.status === "ORPHANED") return;

  const product = await getProduct(env, msg.productId);
  if (!product) return;
  const ivs = await db.select().from(s.importedVariants).where(eq(s.importedVariants.importedProductId, imported.id));
  const catalog = new Map(product.variants.map((v) => [v.id, v]));

  // Read selling prices first: also tells us whether the subscriber deleted the product.
  const live = await getVariantPrices(client, imported.shopifyProductId);
  if (!live) {
    await db.update(s.importedProducts).set({ status: "ORPHANED" }).where(eq(s.importedProducts.id, imported.id));
    return;
  }

  const fields = new Set<SyncedField>(msg.fields);
  const costItems: { variantId: string; costCents: number }[] = [];
  const stockItems: { inventoryItemId: string; quantity: number }[] = [];
  for (const iv of ivs) {
    const v = catalog.get(iv.variantId);
    if (!v || !live.prices.has(iv.shopifyVariantId)) continue;
    if (fields.has("wholesaleCost") && v.wholesaleCost !== iv.lastSyncedCost) costItems.push({ variantId: iv.shopifyVariantId, costCents: v.wholesaleCost });
    if (fields.has("stock") && v.stock !== iv.lastSyncedStock) stockItems.push({ inventoryItemId: iv.inventoryItemId, quantity: v.stock });
  }

  await updateCosts(client, imported.shopifyProductId, costItems);
  if (stockItems.length && shop.locationId) await setStock(client, shop.locationId, stockItems, msg.jobId);

  const stmts: any[] = [];
  for (const iv of ivs) {
    const v = catalog.get(iv.variantId);
    if (!v) continue;
    const price = live.prices.get(iv.shopifyVariantId) ?? iv.lastKnownPrice;
    stmts.push(
      db
        .update(s.importedVariants)
        .set({
          lastKnownPrice: price,
          lastSyncedCost: fields.has("wholesaleCost") ? v.wholesaleCost : iv.lastSyncedCost,
          lastSyncedStock: fields.has("stock") ? v.stock : iv.lastSyncedStock,
        })
        .where(eq(s.importedVariants.id, iv.id)),
    );
  }
  stmts.push(db.update(s.importedProducts).set({ lastSyncedAt: nowIso() }).where(eq(s.importedProducts.id, imported.id)));
  stmts.push(db.update(s.shops).set({ lastSyncAt: nowIso() }).where(eq(s.shops.id, shop.id)));
  await db.batch(stmts as [any, ...any[]]);

  await evaluateMarginAlerts(
    db,
    shop.id,
    ivs.map((iv) => ({ importedVariantId: iv.id, cost: catalog.get(iv.variantId)?.wholesaleCost ?? 0, price: live.prices.get(iv.shopifyVariantId) ?? iv.lastKnownPrice })),
  );
}

/** Opens an alert when cost ≥ selling price; resolves it once the subscriber reprices or cost drops. */
export async function evaluateMarginAlerts(db: DB, shopId: string, rows: { importedVariantId: string; cost: number; price: number | null }[]) {
  if (!rows.length) return;
  const open = await db
    .select()
    .from(s.marginAlerts)
    .where(and(eq(s.marginAlerts.shopId, shopId), isNull(s.marginAlerts.resolvedAt), inArray(s.marginAlerts.importedVariantId, rows.map((r) => r.importedVariantId))));
  const openBy = new Map(open.map((a) => [a.importedVariantId, a]));
  const stmts: any[] = [];
  for (const r of rows) {
    const current = openBy.get(r.importedVariantId);
    const alert = isMarginAlert(r.cost, r.price);
    if (alert && !current) stmts.push(db.insert(s.marginAlerts).values({ id: newId("alr"), shopId, importedVariantId: r.importedVariantId, cost: r.cost, price: r.price! }));
    else if (alert && current && (current.cost !== r.cost || current.price !== r.price))
      stmts.push(db.update(s.marginAlerts).set({ cost: r.cost, price: r.price!, dismissedAt: null }).where(eq(s.marginAlerts.id, current.id)));
    else if (!alert && current) stmts.push(db.update(s.marginAlerts).set({ resolvedAt: nowIso() }).where(eq(s.marginAlerts.id, current.id)));
  }
  if (stmts.length) await db.batch(stmts as [any, ...any[]]);
}

// ── status ───────────────────────────────────────────────────────────────────

async function runStatus(env: Env, db: DB, msg: Extract<JobMessage, { type: "status" }>) {
  const { shop, client } = await shopClient(env, msg.shopId);
  // Re-check at execution time: the subscription may have flipped again since this was enqueued.
  const wanted = productStatusFor(shop.subscriptionStatus as SubscriptionStatus);
  if (wanted && wanted !== msg.status) return;

  const imported = await db.query.importedProducts.findFirst({
    where: and(eq(s.importedProducts.shopId, shop.id), eq(s.importedProducts.productId, msg.productId)),
  });
  if (!imported || imported.status === "ORPHANED" || imported.status === msg.status) return;
  const r = await setProductStatus(client, imported.shopifyProductId, msg.status);
  await db
    .update(s.importedProducts)
    .set({ status: r === "missing" ? "ORPHANED" : msg.status })
    .where(eq(s.importedProducts.id, imported.id));
}

// ── enqueue helpers ──────────────────────────────────────────────────────────

async function createJobs(env: Env, rows: { kind: "import" | "sync" | "status"; shopId: string; productId: string }[]) {
  const db = getDb(env);
  const withIds = rows.map((r) => ({ ...r, id: newId("job") }));
  for (const chunk of chunks(withIds, 12)) await db.insert(s.syncJobs).values(chunk.map((r) => ({ id: r.id, kind: r.kind, shopId: r.shopId, productId: r.productId })));
  return withIds;
}

async function sendAll(env: Env, messages: JobMessage[]) {
  // Queue sendBatch accepts up to 100 messages per call.
  for (const chunk of chunks(messages, 100)) await env.JOBS.sendBatch(chunk.map((body) => ({ body })));
}

export async function enqueueImport(env: Env, shopId: string, productIds: string[]) {
  const db = getDb(env);
  const importJobId = newId("ijb");
  await db.insert(s.importJobs).values({ id: importJobId, shopId, total: productIds.length });
  const jobs = await createJobs(env, productIds.map((productId) => ({ kind: "import" as const, shopId, productId })));
  await sendAll(env, jobs.map((j) => ({ type: "import", jobId: j.id, importJobId, shopId, productId: j.productId })));
  return importJobId;
}

/** Fan out a catalog change to every store that imported the product. */
export async function enqueueSyncForProduct(env: Env, productId: string, fields: SyncedField[], opts: { shopId?: string } = {}) {
  if (!fields.length) return 0;
  const db = getDb(env);
  const rows = await db
    .select({ shopId: s.importedProducts.shopId })
    .from(s.importedProducts)
    .innerJoin(s.shops, eq(s.shops.id, s.importedProducts.shopId))
    .where(
      and(
        eq(s.importedProducts.productId, productId),
        ne(s.importedProducts.status, "ORPHANED"),
        isNull(s.shops.uninstalledAt),
        opts.shopId ? eq(s.importedProducts.shopId, opts.shopId) : undefined,
      ),
    );
  const jobs = await createJobs(env, rows.map((r) => ({ kind: "sync" as const, shopId: r.shopId, productId })));
  await sendAll(env, jobs.map((j) => ({ type: "sync", jobId: j.id, shopId: j.shopId, productId, fields })));
  return jobs.length;
}

/** Flip every imported product of a store to ACTIVE or DRAFT. */
export async function enqueueStatusForShop(env: Env, shopId: string, status: "ACTIVE" | "DRAFT") {
  const db = getDb(env);
  const rows = await db
    .select({ productId: s.importedProducts.productId })
    .from(s.importedProducts)
    .where(and(eq(s.importedProducts.shopId, shopId), ne(s.importedProducts.status, "ORPHANED"), ne(s.importedProducts.status, status)));
  const jobs = await createJobs(env, rows.map((r) => ({ kind: "status" as const, shopId, productId: r.productId })));
  await sendAll(env, jobs.map((j) => ({ type: "status", jobId: j.id, shopId, productId: j.productId, status })));
  return jobs.length;
}
