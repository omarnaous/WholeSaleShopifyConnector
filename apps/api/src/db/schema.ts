import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

// ── Wholesaler catalog ────────────────────────────────────────────────────────

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  collection: text("collection").notNull(),
  style: text("style").notNull(),
  frameMaterial: text("frame_material").notNull(),
  /** JSON array of LensType */
  lensTypes: text("lens_types", { mode: "json" }).$type<string[]>().notNull(),
  gender: text("gender").notNull(),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const variants = sqliteTable(
  "variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    frameColor: text("frame_color").notNull(),
    frameColorHex: text("frame_color_hex").notNull(),
    lensColor: text("lens_color").notNull(),
    lensColorHex: text("lens_color_hex").notNull(),
    size: text("size").notNull(),
    stock: integer("stock").notNull().default(0),
    wholesaleCost: integer("wholesale_cost").notNull(),
    suggestedPrice: integer("suggested_price").notNull(),
    imageKey: text("image_key"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export const images = sqliteTable(
  "images",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: text("variant_id"),
    /** R2 object key, or an absolute URL for externally hosted images. */
    key: text("key").notNull(),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("images_product_idx").on(t.productId)],
);

// ── Subscriber stores ────────────────────────────────────────────────────────

export const shops = sqliteTable("shops", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  accessToken: text("access_token"),
  scope: text("scope"),
  subscriptionId: text("subscription_id"),
  subscriptionStatus: text("subscription_status").notNull().default("NONE"),
  subscriptionTest: integer("subscription_test", { mode: "boolean" }).notNull().default(false),
  currentPeriodEnd: text("current_period_end"),
  locationId: text("location_id"),
  locationName: text("location_name"),
  currency: text("currency"),
  installedAt: text("installed_at").notNull().default(now),
  uninstalledAt: text("uninstalled_at"),
  lastSyncAt: text("last_sync_at"),
});

export const importedProducts = sqliteTable(
  "imported_products",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    shopifyProductId: text("shopify_product_id").notNull(),
    /** ACTIVE / DRAFT mirror what we last set; ORPHANED = subscriber deleted it in Shopify. */
    status: text("status", { enum: ["ACTIVE", "DRAFT", "ORPHANED"] }).notNull().default("ACTIVE"),
    importedAt: text("imported_at").notNull().default(now),
    lastSyncedAt: text("last_synced_at"),
  },
  (t) => [uniqueIndex("imported_shop_product_uq").on(t.shopId, t.productId), index("imported_shopify_id_idx").on(t.shopifyProductId)],
);

export const importedVariants = sqliteTable(
  "imported_variants",
  {
    id: text("id").primaryKey(),
    importedProductId: text("imported_product_id")
      .notNull()
      .references(() => importedProducts.id, { onDelete: "cascade" }),
    shopId: text("shop_id").notNull(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    shopifyVariantId: text("shopify_variant_id").notNull(),
    inventoryItemId: text("inventory_item_id").notNull(),
    /** The subscriber's selling price as last seen (cents). Never written by us after import. */
    lastKnownPrice: integer("last_known_price"),
    lastSyncedCost: integer("last_synced_cost"),
    lastSyncedStock: integer("last_synced_stock"),
  },
  (t) => [uniqueIndex("imported_variant_uq").on(t.shopId, t.variantId), index("imported_variants_shopify_idx").on(t.shopifyVariantId)],
);

// ── Jobs, alerts, audit ──────────────────────────────────────────────────────

export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  shopId: text("shop_id").notNull(),
  total: integer("total").notNull(),
  done: integer("done").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  errors: text("errors", { mode: "json" }).$type<{ productId: string; message: string }[]>().notNull().default(sql`'[]'`),
  createdAt: text("created_at").notNull().default(now),
});

export const syncJobs = sqliteTable(
  "sync_jobs",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["import", "sync", "status"] }).notNull(),
    shopId: text("shop_id").notNull(),
    productId: text("product_id"),
    status: text("status", { enum: ["queued", "running", "done", "failed"] }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: text("created_at").notNull().default(now),
    finishedAt: text("finished_at"),
  },
  (t) => [index("sync_jobs_created_idx").on(t.createdAt)],
);

export const marginAlerts = sqliteTable(
  "margin_alerts",
  {
    id: text("id").primaryKey(),
    shopId: text("shop_id").notNull(),
    importedVariantId: text("imported_variant_id")
      .notNull()
      .references(() => importedVariants.id, { onDelete: "cascade" }),
    cost: integer("cost").notNull(),
    price: integer("price").notNull(),
    createdAt: text("created_at").notNull().default(now),
    resolvedAt: text("resolved_at"),
    dismissedAt: text("dismissed_at"),
  },
  (t) => [index("margin_alerts_shop_idx").on(t.shopId)],
);

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(), // X-Shopify-Webhook-Id → idempotency
  shop: text("shop").notNull(),
  topic: text("topic").notNull(),
  receivedAt: text("received_at").notNull().default(now),
});
