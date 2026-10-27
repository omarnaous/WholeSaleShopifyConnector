# @lumen/shopify — embedded Shopify admin app

The merchant-facing app that runs inside the Shopify admin: browse the Lumen wholesale catalog, import
sunglasses into the store, watch stock/cost sync and margin alerts, and manage the subscription.

Vite + React 19 + react-router 7 (library mode). UI is **Polaris web components** (`<s-page>`, `<s-section>`,
`<s-button>` …) and **App Bridge**, both loaded from Shopify's CDN in `index.html` — they are not bundled.

## How it is served

There is no separate frontend host. The Cloudflare Worker in `apps/api` serves this app's build output
(`apps/shopify/dist`, see `assets` in `apps/api/wrangler.jsonc`) as static assets with SPA fallback, and
handles `/api/*`, `/webhooks/*` and `/img/*` itself. Because the page and the API share an origin:

- every call is relative (`/api/app/*`) and no CORS is needed;
- App Bridge's session token is attached by `src/api.ts` (`Authorization: Bearer <shopify.idToken()>`);
  the first call (`GET /api/app/state`) also performs the token exchange that installs the store.

Build the frontend before deploying the worker:

```sh
VITE_SHOPIFY_API_KEY=<client id> pnpm --filter @lumen/shopify build
pnpm --filter @lumen/api deploy
```

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SHOPIFY_API_KEY` | build time (`.env.local` or shell) | Written into `<meta name="shopify-api-key">`; App Bridge needs it. Same value as `client_id` in `shopify.app.toml` and the worker's `SHOPIFY_API_KEY` secret. |
| `VITE_DEMO` | optional | `1` = serve fixtures instead of calling the API (see below). |

See `.env.example`.

## Screens

| Route | |
| --- | --- |
| `/catalog` (home) | Search + filters (collection, style, frame color, lens, gender, in stock), product cards with colourway swatches, multi-select and import with live progress. |
| `/imported` | Imported products, their status (Active / Draft / Deleted in Shopify) and per-variant stock, cost, *your* price and margin. |
| `/alerts` | Variants whose wholesale cost reached the merchant's selling price. Dismiss or jump to the product in Shopify. |
| `/billing` | Plan & billing. Shown in place of every other screen until the subscription is `ACTIVE`; any `402 SUBSCRIPTION_REQUIRED` from the API also routes here. |

Navigation is declared with App Bridge's `<s-app-nav>` (rendered in the admin sidebar, not in the iframe).
App Bridge dispatches `shopify:navigate` on link clicks; `App.tsx` forwards it to react-router.

## Shopify CLI

`shopify.app.toml` holds the app's scopes, URLs and webhook subscriptions. Replace `client_id` and the
`example.workers.dev` URLs with your own, then:

```sh
cd apps/shopify
shopify app deploy          # push config (scopes, webhooks, URLs) to Shopify
```

For development the frontend talks to `wrangler dev` through the Vite proxy (`/api`, `/webhooks`, `/img` →
`http://127.0.0.1:8787`):

```sh
pnpm dev:api                # wrangler dev on :8787
pnpm dev:shopify            # vite on :5175
```

To load it inside a dev store, expose a public HTTPS URL (e.g. a Cloudflare tunnel pointing at the worker
after `pnpm --filter @lumen/shopify build`, or at Vite) and set it as `application_url`. Note
`automatically_update_urls_on_dev = false`, so `shopify app dev` won't rewrite the URLs for you — run
`shopify app deploy` after changing them, or flip that flag for tunnel-based development.

## Demo mode (no Shopify needed)

```sh
VITE_DEMO=1 pnpm dev:shopify     # or open http://localhost:5175/?demo=1
```

`src/api.ts` then answers every request from `src/demo/server.ts` (lazily imported, so production never loads
it) using `seedProducts()` from `@lumen/core/seed`:

- catalog filtering via the same `parseFilters` + `filterProducts` the API uses, with generated SVG artwork;
- an import job that completes over ~3 seconds;
- two pre-imported products, one of them with a variant priced below cost (one margin alert);
- billing: cancel sets imported products to Draft, subscribe restores them.

State persists in `sessionStorage`. Start a specific scenario with `?demo=1&status=NONE` (paywall),
`status=CANCELLED` (lapsed banner), etc.; reset from the console with `__lumenDemoReset()`. When the App Bridge
global is missing, `src/demo/shim.ts` provides `shopify.idToken()` and a small `shopify.toast`.

Polaris components still come from the CDN, so the preview needs network access to `cdn.shopify.com`.

## Typing notes

- `tsconfig.json` loads `@shopify/polaris-types` (registers every `<s-*>` element on `React.JSX` with real
  prop types) and `@shopify/app-bridge-types` (the `shopify` global).
- App Bridge types its elements on the *global* `JSX` namespace, which React 19 ignores; `src/app-bridge-jsx.d.ts`
  re-registers `<s-app-nav>` on `React.JSX`.
- React 19 binds `onFoo` props on custom elements to an event literally named `Foo` unless React knows the
  event (`onClick`, `onChange`, `onInput`, `onFocus`, `onBlur` are fine). So Polaris' `onHide`/`onDismiss`/`onRemove`
  props are avoided; the cancel modal is driven by `commandFor`/`command` and `hideOverlay()`.
