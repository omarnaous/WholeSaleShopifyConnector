import { Hono, type MiddlewareHandler } from "hono";
import { and, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { productInput } from "@lumen/core/schemas";
import { type AdminJobRow, type AdminStats, type AdminStoreRow, type SubscriptionStatus, type SyncedField } from "@lumen/core";
import type { AppContext } from "../env";
import * as s from "../db/schema";
import { getDb, getProduct, listProducts, newId, nowIso, saveProduct } from "../db/repo";
import { safeEqual } from "../lib/shopify/auth";
import { enqueueSyncForProduct } from "../jobs/handlers";

export const admin = new Hono<AppContext>();

const secret = (k: string) => new TextEncoder().encode(k);

admin.post("/login", async (c) => {
  const { password } = z.object({ password: z.string() }).parse(await c.req.json());
  if (!c.env.ADMIN_PASSWORD || !safeEqual(password, c.env.ADMIN_PASSWORD)) return c.json({ error: "Invalid password" }, 401);
  const token = await new SignJWT({ role: "wholesaler" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(secret(c.env.ADMIN_JWT_SECRET));
  return c.json({ token });
});

const adminAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  try {
    if (!token) throw new Error();
    await jwtVerify(token, secret(c.env.ADMIN_JWT_SECRET), { algorithms: ["HS256"] });
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};
admin.use("*", async (c, next) => (c.req.path.endsWith("/login") ? next() : adminAuth(c, next)));

/** After a save, push stock/cost changes to every store that imported the product. */
async function fanOut(env: AppContext["Bindings"], productId: string, changes: Map<string, SyncedField[]>) {
  const fields = [...new Set([...changes.values()].flat())];
  return enqueueSyncForProduct(env, productId, fields);
}

admin.get("/stats", async (c) => {
  const db = getDb(c.env);
  const since = new Date(Date.now() - 864e5).toISOString();
  const [products, variants, totalStores, activeStores, imported, low, done, failed] = await Promise.all([
    db.$count(s.products, eq(s.products.status, "active")),
    db.$count(s.variants),
    db.$count(s.shops, isNull(s.shops.uninstalledAt)),
    db.$count(s.shops, and(isNull(s.shops.uninstalledAt), eq(s.shops.subscriptionStatus, "ACTIVE"))),
    db.$count(s.importedProducts, ne(s.importedProducts.status, "ORPHANED")),
    db.$count(s.variants, lt(s.variants.stock, 10)),
    db.$count(s.syncJobs, and(eq(s.syncJobs.status, "done"), gte(s.syncJobs.createdAt, since))),
    db.$count(s.syncJobs, and(eq(s.syncJobs.status, "failed"), gte(s.syncJobs.createdAt, since))),
  ]);
  const body: AdminStats = { products, variants, activeStores, totalStores, importedProducts: imported, lowStockVariants: low, jobs24h: { done, failed } };
  return c.json(body);
});

admin.get("/products", async (c) => c.json(await listProducts(c.env, { includeArchived: true })));

admin.get("/products/:id", async (c) => {
  const p = await getProduct(c.env, c.req.param("id"));
  if (!p) return c.json({ error: "Not found" }, 404);
  const db = getDb(c.env);
  const stores = await db.$count(s.importedProducts, and(eq(s.importedProducts.productId, p.id), ne(s.importedProducts.status, "ORPHANED")));
  return c.json({ ...p, importedBy: stores });
});

admin.post("/products", async (c) => {
  const input = productInput.parse(await c.req.json());
  const { product } = await saveProduct(c.env, input);
  return c.json(product, 201);
});

admin.put("/products/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await getProduct(c.env, id))) return c.json({ error: "Not found" }, 404);
  const input = productInput.parse(await c.req.json());
  const { product, syncChanges } = await saveProduct(c.env, input, id);
  const queued = await fanOut(c.env, id, syncChanges);
  return c.json({ product, syncJobsQueued: queued });
});

/** Archive rather than hard-delete: stores that imported it keep their mapping. */
admin.delete("/products/:id", async (c) => {
  await getDb(c.env).update(s.products).set({ status: "archived", updatedAt: nowIso() }).where(eq(s.products.id, c.req.param("id")));
  return c.json({ ok: true });
});

const variantPatch = z.object({ stock: z.number().int().min(0).optional(), wholesaleCost: z.number().int().min(0).optional(), suggestedPrice: z.number().int().min(0).optional() });

/** Inline stock / cost edit from the products table. */
admin.patch("/variants/:id", async (c) => {
  const patch = variantPatch.parse(await c.req.json());
  const db = getDb(c.env);
  const v = await db.query.variants.findFirst({ where: eq(s.variants.id, c.req.param("id")) });
  if (!v) return c.json({ error: "Not found" }, 404);
  await db.update(s.variants).set(patch).where(eq(s.variants.id, v.id));
  await db.update(s.products).set({ updatedAt: nowIso() }).where(eq(s.products.id, v.productId));
  const fields: SyncedField[] = [];
  if (patch.stock !== undefined && patch.stock !== v.stock) fields.push("stock");
  if (patch.wholesaleCost !== undefined && patch.wholesaleCost !== v.wholesaleCost) fields.push("wholesaleCost");
  const queued = await enqueueSyncForProduct(c.env, v.productId, fields);
  return c.json({ ok: true, syncJobsQueued: queued });
});

const ALLOWED_IMAGE_TYPES = new Set(["image/avif", "image/webp", "image/jpeg", "image/png"]);

admin.post("/images", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "file is required" }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return c.json({ error: "Unsupported image type" }, 415);
  if (file.size > 10 * 1024 * 1024) return c.json({ error: "Max 10 MB" }, 413);
  const ext = file.type.split("/")[1];
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${newId("img")}.${ext}`;
  await c.env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  return c.json({ key, url: `${c.env.PUBLIC_URL}/img/${key}` }, 201);
});

admin.get("/stores", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: s.shops.id,
      shop: s.shops.domain,
      subscriptionStatus: s.shops.subscriptionStatus,
      installedAt: s.shops.installedAt,
      uninstalledAt: s.shops.uninstalledAt,
      lastSyncAt: s.shops.lastSyncAt,
      // Raw, table-qualified SQL: drizzle renders bare column names inside sql``, which would make this self-referential.
      importedProducts: sql<number>`(select count(*) from imported_products ip where ip.shop_id = shops.id and ip.status != 'ORPHANED')`,
    })
    .from(s.shops)
    .orderBy(desc(s.shops.installedAt));
  return c.json(rows.map((r) => ({ ...r, subscriptionStatus: r.subscriptionStatus as SubscriptionStatus })) satisfies AdminStoreRow[]);
});

/** Manual "resync everything" for one store (support tool). */
admin.post("/stores/:id/resync", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select({ productId: s.importedProducts.productId }).from(s.importedProducts).where(eq(s.importedProducts.shopId, c.req.param("id")));
  // Clear last-synced markers so the jobs push current values even if they did not change.
  await db.update(s.importedVariants).set({ lastSyncedCost: null, lastSyncedStock: null }).where(eq(s.importedVariants.shopId, c.req.param("id")));
  let queued = 0;
  for (const r of rows) queued += await enqueueSyncForProduct(c.env, r.productId, ["stock", "wholesaleCost"], { shopId: c.req.param("id") });
  return c.json({ queued });
});

admin.get("/jobs", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: s.syncJobs.id,
      kind: s.syncJobs.kind,
      shop: s.shops.domain,
      productName: s.products.name,
      status: s.syncJobs.status,
      error: s.syncJobs.error,
      createdAt: s.syncJobs.createdAt,
      finishedAt: s.syncJobs.finishedAt,
    })
    .from(s.syncJobs)
    .leftJoin(s.shops, eq(s.shops.id, s.syncJobs.shopId))
    .leftJoin(s.products, eq(s.products.id, s.syncJobs.productId))
    .orderBy(desc(s.syncJobs.createdAt))
    .limit(200);
  return c.json(rows.map((r) => ({ ...r, shop: r.shop ?? "—" })) satisfies AdminJobRow[]);
});

