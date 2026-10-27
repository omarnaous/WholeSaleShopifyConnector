/**
 * In-browser stand-in for /api/app/* used by demo mode (VITE_DEMO=1 or ?demo=1).
 * Mirrors the contract in apps/api/src/routes/app.ts closely enough to exercise every screen:
 * subscription gating (402), filters, an import job that progresses over ~3s, imported rows,
 * margin alerts and the cancel → Draft → resubscribe → Active loop.
 *
 * State lives in sessionStorage so the billing redirect (a full page load) keeps it.
 */
import {
  PLAN,
  filterProducts,
  isMarginAlert,
  isSubscriptionActive,
  parseFilters,
  type AppCatalogProduct,
  type ImportJobState,
  type ImportedRow,
  type MarginAlertRow,
  type Product,
  type ShopState,
  type SubscriptionStatus,
} from "@lumen/core";
import { seedProducts } from "@lumen/core/seed";
import { sunglassesSvg } from "./art";

const STORE_KEY = "lumen-demo-db";
const SHOP = "lumen-demo.myshopify.com";
const IMPORT_MS = 3000;

interface ImportedEntry {
  status: "ACTIVE" | "DRAFT" | "ORPHANED";
  shopifyProductId: string;
  importedAt: string;
  lastSyncedAt: string;
  /** variantId → the merchant's selling price (cents) */
  prices: Record<string, number>;
}

interface Job {
  id: string;
  startedAt: number;
  productIds: string[];
}

interface Db {
  status: SubscriptionStatus;
  periodEnd: string | null;
  imported: Record<string, ImportedEntry>;
  dismissed: string[];
  jobs: Record<string, Job>;
  nextGid: number;
}

const catalog: Product[] = seedProducts().map((p) => {
  const variants = p.variants.map((v) => ({ ...v, imageUrl: sunglassesSvg(p.style, v.frameColorHex, v.lensColorHex) }));
  return { ...p, variants, images: p.images.map((img) => ({ ...img, url: variants.find((v) => v.id === img.variantId)?.imageUrl ?? img.url })) };
});
const byId = new Map(catalog.map((p) => [p.id, p]));

const daysFromNow = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

function initialDb(): Db {
  const sp = new URLSearchParams(window.location.search);
  const status = (sp.get("status")?.toUpperCase() as SubscriptionStatus | undefined) ?? "ACTIVE";
  const db: Db = { status, periodEnd: status === "ACTIVE" ? daysFromNow(23) : null, imported: {}, dismissed: [], jobs: {}, nextGid: 9000001 };
  // Two products already in the store; the second one has a variant repriced below cost → one margin alert.
  const [a, b] = catalog;
  for (const [i, p] of [a, b].entries()) {
    if (!p) continue;
    const prices = Object.fromEntries(p.variants.map((v) => [v.id, v.suggestedPrice]));
    const firstVariant = p.variants[0];
    if (i === 1 && firstVariant) prices[firstVariant.id] = firstVariant.wholesaleCost - 300;
    db.imported[p.id] = {
      status: isSubscriptionActive(status) ? "ACTIVE" : "DRAFT",
      shopifyProductId: `gid://shopify/Product/${db.nextGid++}`,
      importedAt: daysFromNow(-6 + i),
      lastSyncedAt: new Date(Date.now() - (i + 1) * 47 * 60_000).toISOString(),
      prices,
    };
  }
  return db;
}

function load(): Db {
  // `?status=CANCELLED` (etc.) always starts a fresh scenario.
  if (new URLSearchParams(window.location.search).has("status")) return initialDb();
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* fall through */
  }
  return initialDb();
}

let db = load();
function save() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {
    /* private mode: state is per page load */
  }
}

/** Materialises imported products for jobs whose (simulated) work time has passed. */
function tick(now = Date.now()) {
  for (const job of Object.values(db.jobs)) {
    job.productIds.forEach((id, i) => {
      if (db.imported[id] && db.imported[id].status !== "ORPHANED") return;
      if (now < doneAt(job, i)) return;
      const p = byId.get(id);
      if (!p) return;
      db.imported[id] = {
        status: "ACTIVE",
        shopifyProductId: `gid://shopify/Product/${db.nextGid++}`,
        importedAt: new Date(now).toISOString(),
        lastSyncedAt: new Date(now).toISOString(),
        prices: Object.fromEntries(p.variants.map((v) => [v.id, v.suggestedPrice])),
      };
    });
  }
  save();
}

const doneAt = (job: Job, i: number) => job.startedAt + 400 + ((i + 1) / job.productIds.length) * IMPORT_MS;

const shopState = (): ShopState => ({
  shop: SHOP,
  subscription: { status: db.status, currentPeriodEnd: db.periodEnd, trialDays: PLAN.trialDays, test: true },
  plan: { name: PLAN.name, price: PLAN.priceCents, currency: PLAN.currency, trialDays: PLAN.trialDays },
  importedCount: Object.values(db.imported).filter((i) => i.status !== "ORPHANED").length,
  openAlerts: alerts().length,
  location: { id: "gid://shopify/Location/1", name: "Shop location" },
});

function alerts(): MarginAlertRow[] {
  const out: MarginAlertRow[] = [];
  for (const [productId, entry] of Object.entries(db.imported)) {
    const p = byId.get(productId);
    if (!p || entry.status === "ORPHANED") continue;
    for (const v of p.variants) {
      const price = entry.prices[v.id];
      const id = `alr_${v.id}`;
      if (price == null || !isMarginAlert(v.wholesaleCost, price) || db.dismissed.includes(id)) continue;
      out.push({
        id,
        productName: p.name,
        sku: v.sku,
        variantLabel: `${v.frameColor} / ${v.lensColor}`,
        cost: v.wholesaleCost,
        price,
        shopifyProductId: entry.shopifyProductId,
        createdAt: entry.lastSyncedAt,
      });
    }
  }
  return out;
}

function frameColorFacets(products: Product[]) {
  const map = new Map<string, string>();
  for (const p of products) for (const v of p.variants) if (!map.has(v.frameColor)) map.set(v.frameColor, v.frameColorHex);
  return [...map].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name));
}

function setAllStatus(status: "ACTIVE" | "DRAFT") {
  for (const e of Object.values(db.imported)) if (e.status !== "ORPHANED") e.status = status;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function demoFetch(input: string, init: RequestInit): Promise<Response> {
  const url = new URL(input, window.location.origin);
  const method = (init.method ?? "GET").toUpperCase();
  const path = url.pathname;
  await sleep(path.startsWith("/api/app/import/") ? 60 : 220 + Math.random() * 200);
  if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  tick();

  const gated = () => (isSubscriptionActive(db.status) ? null : json({ error: "Subscription required", code: "SUBSCRIPTION_REQUIRED" }, 402));

  if (path === "/api/public/catalog") return json({ products: filterProducts(catalog, {}), facets: { frameColors: frameColorFacets(catalog) } });

  if (path === "/api/app/state" && method === "GET") return json(shopState());

  if (path === "/api/app/billing/subscribe" && method === "POST") {
    // Pretend the merchant approved the charge on Shopify's page; the "redirect" just reloads the app.
    db.status = "ACTIVE";
    db.periodEnd = daysFromNow(30);
    setAllStatus("ACTIVE");
    save();
    const back = new URL(window.location.href);
    back.searchParams.set("demo", "1");
    back.searchParams.delete("status");
    return json({ confirmationUrl: back.toString() });
  }

  if (path === "/api/app/billing/cancel" && method === "POST") {
    db.status = "CANCELLED";
    db.periodEnd = null;
    setAllStatus("DRAFT");
    save();
    return json({ ok: true });
  }

  if (path === "/api/app/catalog" && method === "GET") {
    const blocked = gated();
    if (blocked) return blocked;
    const products: AppCatalogProduct[] = filterProducts(catalog, parseFilters(url.searchParams)).map((p) => {
      const i = db.imported[p.id];
      return { ...p, imported: i ? { status: i.status, shopifyProductId: i.shopifyProductId, importedAt: i.importedAt } : null };
    });
    return json({ products, facets: { frameColors: frameColorFacets(catalog) }, filterKeys: ["collection", "style", "frameColor", "lensType", "gender"] });
  }

  if (path === "/api/app/import" && method === "POST") {
    const blocked = gated();
    if (blocked) return blocked;
    const body = JSON.parse(String(init.body ?? "{}")) as { productIds?: string[]; all?: true };
    const wanted = body.all ? catalog.map((p) => p.id) : (body.productIds ?? []).filter((id) => byId.has(id));
    const todo = wanted.filter((id) => !db.imported[id] || db.imported[id].status === "ORPHANED");
    if (!todo.length) return json({ jobId: null, skipped: wanted.length });
    const id = `job_${Math.random().toString(36).slice(2, 10)}`;
    db.jobs[id] = { id, startedAt: Date.now(), productIds: todo };
    save();
    return json({ jobId: id, skipped: wanted.length - todo.length });
  }

  const jobMatch = path.match(/^\/api\/app\/import\/([^/]+)$/);
  if (jobMatch && method === "GET") {
    const job = db.jobs[decodeURIComponent(jobMatch[1]!)];
    if (!job) return json({ error: "Not found" }, 404);
    const now = Date.now();
    const done = job.productIds.filter((_, i) => now >= doneAt(job, i)).length;
    const body: ImportJobState = {
      id: job.id,
      status: done >= job.productIds.length ? "done" : done > 0 ? "running" : "queued",
      total: job.productIds.length,
      done,
      failed: 0,
      errors: [],
    };
    return json(body);
  }

  if (path === "/api/app/imported" && method === "GET") {
    const rows: ImportedRow[] = Object.entries(db.imported)
      .sort(([, a], [, b]) => b.importedAt.localeCompare(a.importedAt))
      .flatMap(([productId, e]) => {
        const p = byId.get(productId);
        if (!p) return [];
        return [
          {
            productId,
            name: p.name,
            imageUrl: p.variants[0]?.imageUrl ?? null,
            shopifyProductId: e.shopifyProductId,
            status: e.status,
            lastSyncedAt: e.lastSyncedAt,
            variants: p.variants.map((v) => ({
              sku: v.sku,
              label: `${v.frameColor} / ${v.lensColor}`,
              stock: v.stock,
              cost: v.wholesaleCost,
              price: e.prices[v.id] ?? null,
              marginAlert: isMarginAlert(v.wholesaleCost, e.prices[v.id]),
            })),
          },
        ];
      });
    return json(rows);
  }

  if (path === "/api/app/alerts" && method === "GET") return json(alerts());

  const dismissMatch = path.match(/^\/api\/app\/alerts\/([^/]+)\/dismiss$/);
  if (dismissMatch && method === "POST") {
    db.dismissed.push(decodeURIComponent(dismissMatch[1]!));
    save();
    return json({ ok: true });
  }

  return json({ error: `Demo: no fixture for ${method} ${path}` }, 404);
}

/** Exposed for the console: `__lumenDemoReset()` starts over. */
(globalThis as { __lumenDemoReset?: () => void }).__lumenDemoReset = () => {
  db = initialDb();
  save();
  window.location.reload();
};
