# Architecture and decisions

## Data flow

```
Wholesaler admin ──PUT/PATCH──▶ API (D1) ──diff stock/cost──▶ Queue: sync jobs (one per store that imported the product)
                                                               │
Subscriber store ◀──GraphQL (cost + stock only)────────────────┘
       │
       ├─ products/update webhook ──▶ lastKnownPrice ──▶ margin alerts
       ├─ products/delete webhook ──▶ mapping ORPHANED (never recreated)
       └─ app_subscriptions/update ─▶ re-read billing from Shopify ──▶ Queue: status jobs (ACTIVE / DRAFT)
```

## Rules and where they are enforced

| Rule | Enforcement |
|---|---|
| Price = suggested retail on import, never overwritten | `importProduct()` in `apps/api/src/lib/shopify/operations.ts` is the only code that sends `price`. `updateCosts()` sends only `inventoryItem.cost`; the mock Admin API throws if a sync ever includes `price`. |
| Title, description and images are never touched after import | Sync jobs only call `productVariantsBulkUpdate(cost)` and `inventorySetQuantities`. |
| Sync only stock and cost | `changedSyncFields()` in `packages/core/src/rules.ts` diffs a save. Only those fields fan out to stores. |
| Margin alert when cost ≥ selling price | `evaluateMarginAlerts()` runs after every sync and on every `products/update` webhook (the subscriber repriced). Alerts resolve on their own once the margin is healthy again. |
| Block catalog and import without an active plan | `requireActive` middleware returns 402 `SUBSCRIPTION_REQUIRED`. The import job re-checks the plan at run time. |
| Cancelled / unpaid → Draft, resubscribe → Active | `productStatusFor()` maps status: ACTIVE → ACTIVE; CANCELLED, FROZEN (unpaid), EXPIRED, DECLINED → DRAFT; PENDING and ACCEPTED → no change. |
| A subscriber can't re-publish by hand while unsubscribed | `products/update` with status ACTIVE on an inactive shop enqueues DRAFT again. |

## Billing truth

Webhooks can arrive late, more than once, or out of order. The classic case is the old plan's `CANCELLED` landing after the new plan's `ACTIVE`. So the webhook payload is treated as a hint only: every trigger (webhook, app load, cron every 6h) re-reads `currentAppInstallation.activeSubscriptions` and reconciles from that. The e2e test covers the stale-CANCELLED case.

## Shopify API notes (version 2026-07)

- Auth: managed installation plus token exchange (App Bridge session token → offline token). There are no OAuth redirects.
- Import: one `productSet(synchronous: true)` call per product carries the options (Frame, Lens, optional Size), variants, price, cost, tracked stock at the store's primary location, and images (pulled from public R2 URLs). It also writes `lumen.product_id` as a metafield.
- Stock: `inventorySetQuantities` with `changeFromQuantity: null` (the wholesaler's warehouse is the source of truth) and the `@idempotent` key that 2026-04+ requires.
- Throttling: the GraphQL client waits out `THROTTLED` responses using the returned cost and restore rate. The queue consumer runs jobs one at a time within a batch.
- Webhooks: a single HMAC-verified endpoint, deduped on `X-Shopify-Webhook-Id`. Mandatory compliance topics are handled.

The Shopify docs were not reachable from the build sandbox. The GraphQL operations above were written from API knowledge plus changelog search results, and verified against the mock only. Run them once against a real dev store before trusting them. The mutations most likely to need small fixes are `productSet` (exact input field names) and `inventorySetQuantities`.

## Known gaps and blind spots (decide before production)

1. **Order fulfilment is not designed.** If the wholesaler dropships, orders need to reach him, and a sale lowers Shopify's stock, which the next sync then overwrites with warehouse stock. The likely path is a Shopify `FulfillmentService` with its own location per store, plus order routing to the wholesaler. The FAQ copy about fulfilment on the public site is a placeholder.
2. **Uninstall gap.** On `app/uninstalled` the token is already revoked, so imported products can't be set to Draft and stay live in that store. This can't be fixed from the app side. A fulfilment service (1) would at least stop orders from being fulfilled.
3. **Currency.** Cost and price are pushed as plain numbers. A store whose currency isn't USD gets USD figures labelled as its own currency. Convert, or restrict to USD stores.
4. **Variants added after import** are not pushed to stores that already imported the product (that would rewrite the product). Removed variants stay in Shopify.
5. **Duplicate import on a crash window.** If `productSet` succeeds and the D1 write fails, a retry creates a second product. Fix: a unique metafield definition plus `productSet(identifier: { customId })` upsert.
6. **The public site is an SPA.** Meta tags and JSON-LD are static. For product-level SEO, prerender `/catalog` and `/p/:slug` (React Router framework mode with `prerender`).
7. **Admin auth** is a single shared password issuing a 12h JWT. Put Cloudflare Access in front of the admin and the `/api/admin` routes for anything beyond a demo.
8. **Product imagery** is procedurally rendered for the prototype. Real photography will sell better.
