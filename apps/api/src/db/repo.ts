import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { changedSyncFields, slugify, type Product, type ProductInput, type SyncedField } from "@lumen/core";
import * as s from "./schema";
import type { Env } from "../env";

export type DB = DrizzleD1Database<typeof s>;
export const getDb = (env: Env): DB => drizzle(env.DB, { schema: s });

export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
export const nowIso = () => new Date().toISOString();

/** R2 key → public URL. Absolute URLs pass through (externally hosted images). */
export function imageUrl(env: Env, key: string | null | undefined, width?: number): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  const k = key.replace(/^\/+/, "");
  if (env.IMAGE_TRANSFORMS === "on" && width) return `${env.PUBLIC_URL}/cdn-cgi/image/format=auto,fit=scale-down,width=${width}/img/${k}`;
  return `${env.PUBLIC_URL}/img/${k}`;
}

type ProductRow = typeof s.products.$inferSelect;
type VariantRow = typeof s.variants.$inferSelect;
type ImageRow = typeof s.images.$inferSelect;

function toProduct(env: Env, p: ProductRow, vs: VariantRow[], imgs: ImageRow[]): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    collection: p.collection as Product["collection"],
    style: p.style as Product["style"],
    frameMaterial: p.frameMaterial as Product["frameMaterial"],
    lensTypes: p.lensTypes as Product["lensTypes"],
    gender: p.gender as Product["gender"],
    status: p.status,
    updatedAt: p.updatedAt,
    variants: vs
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        id: v.id,
        productId: v.productId,
        sku: v.sku,
        frameColor: v.frameColor,
        frameColorHex: v.frameColorHex,
        lensColor: v.lensColor,
        lensColorHex: v.lensColorHex,
        size: v.size,
        stock: v.stock,
        wholesaleCost: v.wholesaleCost,
        suggestedPrice: v.suggestedPrice,
        imageUrl: imageUrl(env, v.imageKey, 1200),
      })),
    images: imgs
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, url: imageUrl(env, i.key, 1600)!, alt: i.alt, variantId: i.variantId, position: i.position })),
  };
}

export async function listProducts(env: Env, opts: { ids?: string[]; includeArchived?: boolean } = {}): Promise<Product[]> {
  const db = getDb(env);
  const where = and(opts.includeArchived ? undefined : eq(s.products.status, "active"), opts.ids ? inArray(s.products.id, opts.ids) : undefined);
  const rows = await db.select().from(s.products).where(where).orderBy(asc(s.products.collection), asc(s.products.name));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  // D1 caps bound parameters at 100 per statement → chunk.
  const vs: VariantRow[] = [];
  const imgs: ImageRow[] = [];
  for (const chunk of chunks(ids, 90)) {
    vs.push(...(await db.select().from(s.variants).where(inArray(s.variants.productId, chunk))));
    imgs.push(...(await db.select().from(s.images).where(inArray(s.images.productId, chunk))));
  }
  return rows.map((p) =>
    toProduct(
      env,
      p,
      vs.filter((v) => v.productId === p.id),
      imgs.filter((i) => i.productId === p.id),
    ),
  );
}

export async function getProduct(env: Env, id: string) {
  const [p] = await listProducts(env, { ids: [id], includeArchived: true });
  return p ?? null;
}

export async function getProductBySlug(env: Env, slug: string) {
  const db = getDb(env);
  const row = await db.query.products.findFirst({ where: eq(s.products.slug, slug) });
  return row ? getProduct(env, row.id) : null;
}

/** Strip our own public prefix so we store R2 keys, not URLs. */
function toKey(env: Env, url: string | null | undefined) {
  if (!url) return null;
  const prefix = `${env.PUBLIC_URL}/img/`;
  if (url.startsWith(prefix)) return url.slice(prefix.length);
  const m = url.match(/\/img\/(.+)$/);
  if (m && url.includes("/cdn-cgi/image/")) return m[1]!;
  return url;
}

export interface SaveResult {
  product: Product;
  /** variantId → which synced fields changed (stock / cost). Drives the sync fan-out. */
  syncChanges: Map<string, SyncedField[]>;
}

/**
 * Create or update a product. Variants are matched by id, then by SKU.
 * Returns which variants had stock/cost changes so the caller can enqueue sync jobs.
 */
export async function saveProduct(env: Env, input: ProductInput, id?: string): Promise<SaveResult> {
  const db = getDb(env);
  const productId = id ?? newId("prd");
  const slug = input.slug ?? slugify(input.name);
  const existing = id ? await db.select().from(s.variants).where(eq(s.variants.productId, id)) : [];
  const byId = new Map(existing.map((v) => [v.id, v]));
  const bySku = new Map(existing.map((v) => [v.sku, v]));
  const syncChanges = new Map<string, SyncedField[]>();

  const stmts: any[] = [];
  if (id) {
    stmts.push(
      db
        .update(s.products)
        .set({
          name: input.name,
          slug,
          description: input.description,
          collection: input.collection,
          style: input.style,
          frameMaterial: input.frameMaterial,
          lensTypes: input.lensTypes,
          gender: input.gender,
          status: input.status,
          updatedAt: nowIso(),
        })
        .where(eq(s.products.id, id)),
    );
  } else {
    stmts.push(
      db.insert(s.products).values({
        id: productId,
        slug,
        name: input.name,
        description: input.description,
        collection: input.collection,
        style: input.style,
        frameMaterial: input.frameMaterial,
        lensTypes: input.lensTypes,
        gender: input.gender,
        status: input.status,
      }),
    );
  }

  const keep = new Set<string>();
  const skuToVariantId = new Map<string, string>();
  input.variants.forEach((v, position) => {
    const prev = (v.id && byId.get(v.id)) || bySku.get(v.sku);
    const vid = prev?.id ?? newId("var");
    keep.add(vid);
    skuToVariantId.set(v.sku, vid);
    const row = {
      sku: v.sku,
      frameColor: v.frameColor,
      frameColorHex: v.frameColorHex,
      lensColor: v.lensColor,
      lensColorHex: v.lensColorHex,
      size: v.size,
      stock: v.stock,
      wholesaleCost: v.wholesaleCost,
      suggestedPrice: v.suggestedPrice,
      imageKey: toKey(env, v.imageUrl),
      position,
    };
    if (prev) {
      const changed = changedSyncFields(prev, v);
      if (changed.length) syncChanges.set(vid, changed);
      stmts.push(db.update(s.variants).set(row).where(eq(s.variants.id, vid)));
    } else {
      stmts.push(db.insert(s.variants).values({ id: vid, productId, ...row }));
    }
  });
  const removed = existing.filter((v) => !keep.has(v.id)).map((v) => v.id);
  if (removed.length) stmts.push(db.delete(s.variants).where(inArray(s.variants.id, removed)));

  stmts.push(db.delete(s.images).where(eq(s.images.productId, productId)));
  input.images.forEach((img, position) => {
    stmts.push(
      db.insert(s.images).values({
        id: newId("img"),
        productId,
        variantId: img.variantSku ? (skuToVariantId.get(img.variantSku) ?? null) : null,
        key: toKey(env, img.url)!,
        alt: img.alt,
        position,
      }),
    );
  });

  await db.batch(stmts as [any, ...any[]]);
  const product = (await getProduct(env, productId))!;
  return { product, syncChanges };
}

export function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export async function getShop(env: Env, domain: string) {
  return getDb(env).query.shops.findFirst({ where: eq(s.shops.domain, domain) });
}
export async function getShopById(env: Env, id: string) {
  return getDb(env).query.shops.findFirst({ where: eq(s.shops.id, id) });
}
