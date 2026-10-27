/**
 * End-to-end check of the subscriber lifecycle against the local worker + mock Shopify.
 *   1. tsx scripts/mock-shopify.ts
 *   2. wrangler dev --var SHOPIFY_ADMIN_ORIGIN:http://127.0.0.1:9911   (with .dev.vars)
 *   3. tsx scripts/e2e.ts
 */
import { createHmac } from "node:crypto";
import { SignJWT } from "jose";

const API = process.env.API ?? "http://127.0.0.1:8787";
const MOCK = "http://127.0.0.1:9911";
const KEY = process.env.SHOPIFY_API_KEY ?? "test-key";
const SECRET = process.env.SHOPIFY_API_SECRET ?? "test-secret";
const SHOP = "lumen-demo.myshopify.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function check(cond: unknown, msg: string) {
  if (!cond) throw new Error(`✗ ${msg}`);
  passed++;
  console.log(`✓ ${msg}`);
}

async function sessionToken() {
  return new SignJWT({ dest: `https://${SHOP}`, sid: "s" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(`https://${SHOP}/admin`)
    .setAudience(KEY)
    .setSubject("1")
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime("1m")
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(SECRET));
}

async function app(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/api/app${path}`, { ...init, headers: { authorization: `Bearer ${await sessionToken()}`, "content-type": "application/json", ...init.headers } });
  return { status: res.status, body: (await res.json()) as any };
}

async function webhook(topic: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  const hmac = createHmac("sha256", SECRET).update(raw).digest("base64");
  return fetch(`${API}/webhooks/shopify`, {
    method: "POST",
    body: raw,
    headers: { "x-shopify-topic": topic, "x-shopify-shop-domain": SHOP, "x-shopify-hmac-sha256": hmac, "x-shopify-webhook-id": crypto.randomUUID(), "content-type": "application/json" },
  });
}

const mock = async () => (await (await fetch(`${MOCK}/__state`)).json()) as any;

async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, label: string, ms = 15000) {
  const end = Date.now() + ms;
  let v = await fn();
  while (!ok(v)) {
    if (Date.now() > end) throw new Error(`timeout: ${label} (last: ${JSON.stringify(v).slice(0, 300)})`);
    await sleep(300);
    v = await fn();
  }
  return v;
}

async function main() {
  // Install via token exchange
  let r = await app("/state");
  check(r.status === 200 && r.body.subscription.status === "NONE", "install: token exchange + state (no plan)");
  check(r.body.location?.id === "gid://shopify/Location/1", "install: inventory location picked");

  r = await app("/catalog");
  check(r.status === 402, "catalog blocked without subscription");

  // Bad HMAC is rejected
  const bad = await fetch(`${API}/webhooks/shopify`, { method: "POST", body: "{}", headers: { "x-shopify-hmac-sha256": "nope", "x-shopify-topic": "app/uninstalled" } });
  check(bad.status === 401, "webhook with bad HMAC rejected");

  // Subscribe
  r = await app("/billing/subscribe", { method: "POST" });
  check(typeof r.body.confirmationUrl === "string", "billing: appSubscriptionCreate returns confirmationUrl");
  const created = (await mock()).log.find((l: any) => l.op === "CreateSubscription");
  check(created.variables.test === true, "billing: test charge on dev store");
  const sub = await (await fetch(`${MOCK}/__approve`)).json();
  await webhook("app_subscriptions/update", { app_subscription: { admin_graphql_api_id: sub.id, status: "ACTIVE" } });
  await until(() => app("/state"), (x) => x.body.subscription.status === "ACTIVE", "subscription active");
  check(true, "webhook APP_SUBSCRIPTIONS_UPDATE → ACTIVE");

  // Catalog + import
  r = await app("/catalog?collection=aviator&lensType=polarized");
  check(r.status === 200 && r.body.products.length > 0 && r.body.products.every((p: any) => p.collection === "aviator"), `catalog filter works (${r.body.products.length} aviators, polarized)`);
  const picked = r.body.products.slice(0, 2);
  r = await app("/import", { method: "POST", body: JSON.stringify({ productIds: picked.map((p: any) => p.id) }) });
  const jobId = r.body.jobId;
  check(jobId, "import job queued");
  const job = await until(() => app(`/import/${jobId}`), (x) => x.body.status === "done" || x.body.status === "failed", "import done");
  check(job.body.done === 2 && job.body.failed === 0, "import: 2/2 products created");

  let m = await mock();
  const shopifyProduct = m.products.find((p: any) => p.title === picked[0].name);
  const v0 = picked[0].variants[0];
  check(shopifyProduct.variants[0].price === (v0.suggestedPrice / 100).toFixed(2), "import: price = suggested retail");
  check(shopifyProduct.variants[0].cost === (v0.wholesaleCost / 100).toFixed(2), "import: cost per item = wholesale cost");
  check(shopifyProduct.variants.length === picked[0].variants.length, "import: all variants created");

  r = await app("/import", { method: "POST", body: JSON.stringify({ productIds: [picked[0].id] }) });
  check(r.body.jobId === null && r.body.skipped === 1, "re-import is a no-op (no duplicates)");

  // Subscriber changes their own price → must never be overwritten
  await fetch(`${MOCK}/__set-price`, { method: "POST", body: JSON.stringify({ sku: v0.sku, price: "120.00" }) });

  // Wholesaler raises cost above selling price + changes stock
  const login = await (await fetch(`${API}/api/admin/login`, { method: "POST", body: JSON.stringify({ password: process.env.ADMIN_PASSWORD ?? "admin" }), headers: { "content-type": "application/json" } })).json();
  check(login.token, "admin login");
  const patch = await (
    await fetch(`${API}/api/admin/variants/${v0.id}`, {
      method: "PATCH",
      body: JSON.stringify({ wholesaleCost: 13000, stock: 3 }),
      headers: { "content-type": "application/json", authorization: `Bearer ${login.token}` },
    })
  ).json();
  check(patch.syncJobsQueued === 1, "admin edit fans out one sync job per importing store");

  m = await until(mock, (x) => x.products.find((p: any) => p.id === shopifyProduct.id).variants[0].cost === "130.00", "cost synced");
  const synced = m.products.find((p: any) => p.id === shopifyProduct.id).variants[0];
  check(synced.cost === "130.00" && synced.available === 3, "sync: cost + stock pushed");
  check(synced.price === "120.00", "sync: subscriber's price untouched");
  check(!m.log.some((l: any) => l.op === "ImportProduct" && l.variables.input.title === picked[0].name && m.log.indexOf(l) > m.log.findIndex((x: any) => x.op === "UpdateCosts")), "sync: no title/description/image rewrite");

  const alerts = await until(() => app("/alerts"), (x) => x.body.length > 0, "margin alert");
  check(alerts.body[0].cost === 13000 && alerts.body[0].price === 12000, "margin alert raised (cost $130 > price $120)");

  // Cancel → DRAFT
  await app("/billing/cancel", { method: "POST" });
  await until(mock, (x) => x.products.every((p: any) => p.status === "DRAFT"), "products drafted");
  check(true, "cancel → all imported products DRAFT");
  r = await app("/catalog");
  check(r.status === 402, "catalog blocked again after cancel");

  // Resubscribe → ACTIVE
  await app("/billing/subscribe", { method: "POST" });
  const sub2 = await (await fetch(`${MOCK}/__approve`)).json();
  await webhook("app_subscriptions/update", { app_subscription: { admin_graphql_api_id: sub2.id, status: "ACTIVE" } });
  await until(mock, (x) => x.products.every((p: any) => p.status === "ACTIVE"), "products re-activated");
  check(true, "resubscribe → products ACTIVE again");

  // Duplicate webhook delivery is ignored
  const raw = JSON.stringify({ app_subscription: { status: "CANCELLED" } });
  const hmac = createHmac("sha256", SECRET).update(raw).digest("base64");
  const headers = { "x-shopify-topic": "app_subscriptions/update", "x-shopify-shop-domain": SHOP, "x-shopify-hmac-sha256": hmac, "x-shopify-webhook-id": "dup-1" };
  await fetch(`${API}/webhooks/shopify`, { method: "POST", body: raw, headers });
  const dup = await (await fetch(`${API}/webhooks/shopify`, { method: "POST", body: raw, headers })).text();
  check(dup === "duplicate", "duplicate webhook id deduped");
  // ...and a stale CANCELLED for the OLD plan does not draft anything: Shopify still reports ACTIVE.
  await sleep(1500);
  r = await app("/state");
  check(r.body.subscription.status === "ACTIVE", "stale CANCELLED webhook ignored (reconciled against Shopify)");

  console.log(`\n${passed} checks passed`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
