# LUMEN — wholesale sunglasses syndication for Shopify

A prototype SaaS for a sunglasses wholesaler. Shopify store owners install the app, subscribe monthly, pick frames from the catalog, and those frames are created as real Shopify products in their store. Stock and cost-per-item then stay in sync automatically. Cancelling sets every imported product to Draft; re-subscribing brings them back.

## Surfaces

| App | Path | Stack | Hosting |
|---|---|---|---|
| Public brand site | `apps/web` | React 19 + Vite + Tailwind 4 + Motion + Lenis + React Three Fiber | Cloudflare Pages |
| Shopify embedded app | `apps/shopify` | React 19 + Vite + App Bridge + Polaris web components | Served by the API worker (same origin) |
| Wholesaler admin | `apps/admin` | React 19 + Vite + Tailwind 4 + Motion | Cloudflare Pages |
| API, webhooks, jobs | `apps/api` | Hono on Cloudflare Workers + D1 + R2 + Queues + Cron | Cloudflare Workers |
| Shared domain | `packages/core` | Types, filters, pricing/subscription rules, seed catalog | — |

```
apps/
  api/        Worker: /api/public, /api/admin, /api/app (embedded), /webhooks/shopify, /img/* (R2), queue consumer, cron
    src/lib/shopify/   auth (session token, token exchange, HMAC), GraphQL client, operations (productSet, cost, stock, status, billing)
    src/jobs/          import / sync / status jobs + fan-out helpers
    scripts/           seed SQL, R2 image upload, mock Admin API, end-to-end lifecycle test
  shopify/    Embedded app UI + shopify.app.toml
  admin/      Wholesaler dashboard
  web/        Public site; src/three = procedural 3D sunglasses; scripts/render-products.ts = product shots
packages/
  core/       @lumen/core (types, rules), @lumen/core/schemas (zod), @lumen/core/seed (24 demo frames)
docs/ARCHITECTURE.md   How sync, billing and pricing rules are enforced, plus known gaps
```

## Run it locally

Prerequisites: Node 22+, pnpm 10.

```bash
pnpm install

# API (D1 + R2 + Queues all run locally in wrangler)
cd apps/api
cp .dev.vars.example .dev.vars            # set SHOPIFY_API_KEY / SECRET, ADMIN_PASSWORD, ADMIN_JWT_SECRET
pnpm db:migrate:local && pnpm db:seed:local
pnpm images:upload:local                  # product shots → local R2
pnpm --filter @lumen/shopify build        # the worker serves the embedded app from ../shopify/dist
pnpm dev                                  # http://127.0.0.1:8787

# Website
pnpm dev:web                              # http://localhost:5173  (VITE_API_URL=http://127.0.0.1:8787 for live data)

# Admin
pnpm dev:admin                            # http://localhost:5174  (password from .dev.vars)

# Embedded app without Shopify (demo fixtures)
pnpm dev:shopify                          # http://localhost:5175/?demo=1
```

### End-to-end lifecycle test (no Shopify store needed)

`apps/api/scripts/mock-shopify.ts` is a small in-memory stand-in for the Admin API. The e2e script drives install → billing → import → cost/stock sync → margin alert → cancel (Draft) → resubscribe (Active) → webhook dedupe:

```bash
cd apps/api
npx tsx scripts/mock-shopify.ts &
npx wrangler dev --port 8787 --ip 127.0.0.1 --var SHOPIFY_ADMIN_ORIGIN:http://127.0.0.1:9911 &
SHOPIFY_API_KEY=test-key SHOPIFY_API_SECRET=test-secret ADMIN_PASSWORD=admin npx tsx scripts/e2e.ts   # 25 checks
```

## Connect a real dev store

1. Create an app in the Shopify Partner Dashboard and copy the client ID and secret.
2. `apps/shopify/shopify.app.toml`: set `client_id`, `application_url` (the deployed worker URL) and the webhook URIs.
3. Deploy the API (below), then `shopify app deploy` from `apps/shopify` to push scopes and webhooks.
4. Install on the dev store. Billing runs with `test: true` while `BILLING_TEST=true`.

The worker must be reachable publicly: Shopify calls the webhooks, and `productSet` downloads product images from `PUBLIC_URL/img/...`. For local work against a real store, put a tunnel in front of `wrangler dev` (for example `cloudflared tunnel --url http://localhost:8787`) and use that URL.

## Deploy (Cloudflare)

```bash
cd apps/api
wrangler d1 create lumen                 # paste database_id into wrangler.jsonc
wrangler r2 bucket create lumen-images
wrangler queues create lumen-jobs && wrangler queues create lumen-jobs-dlq
wrangler secret put SHOPIFY_API_KEY      # also: SHOPIFY_API_SECRET, ADMIN_PASSWORD, ADMIN_JWT_SECRET
pnpm db:migrate:remote && pnpm db:seed:remote && pnpm images:upload:remote
VITE_SHOPIFY_API_KEY=<client id> pnpm --filter @lumen/shopify build   # bundled into the worker as static assets
pnpm run deploy                          # set PUBLIC_URL + CORS_ORIGINS vars first

# Pages projects (build command / output dir)
#   web:   pnpm --filter @lumen/web build    → apps/web/dist     env: VITE_API_URL, VITE_SHOPIFY_CLIENT_ID
#   admin: pnpm --filter @lumen/admin build  → apps/admin/dist   env: VITE_API_URL
```

Set `IMAGE_TRANSFORMS=on` once the zone has Cloudflare Image Transformations enabled; the API then serves resized AVIF/WebP via `/cdn-cgi/image/`. The public site already ships pre-encoded AVIF/WebP product shots.

## Regenerating product shots

Product images are rendered from the same procedural 3D model the hero uses (no photography needed for the prototype):

```bash
pnpm dev:web                              # keep running
pnpm --filter @lumen/web render:products  # → apps/web/public/products/*.{avif,webp} (1200w + 600w), skips existing; --force to redo
```

Replace them with real photography whenever it exists. Upload through the admin and the wholesaler's images are used instead.

## Checks

```bash
pnpm typecheck
pnpm --filter @lumen/core test
pnpm build
```
