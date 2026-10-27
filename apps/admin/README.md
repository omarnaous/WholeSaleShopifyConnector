# @lumen/admin — wholesaler dashboard

The LUMEN wholesaler's admin: manage the sunglasses catalog (products, variants, images), watch subscriber stores and the sync-job log. It is a static SPA (Vite + React 19 + react-router v7 + Tailwind v4 + motion) that talks to the Worker API in `apps/api` under `/api/admin/*`.

## Environment

| Variable       | Default                 | Purpose                                                    |
| -------------- | ----------------------- | ---------------------------------------------------------- |
| `VITE_API_URL` | `http://127.0.0.1:8787` | Base URL of the API Worker (no trailing slash, no `/api`). |

Put local overrides in `apps/admin/.env.local`. For production, set `VITE_API_URL` in the Cloudflare Pages project's build environment. It is baked in at build time.

The API must list the admin's origin in its `CORS_ORIGINS` var (locally `http://localhost:5174`). The admin password is the API's `ADMIN_PASSWORD` secret. Login returns a 12-hour HS256 JWT that is kept in `localStorage` (`lumen.admin.token`). Any `401` drops it and sends you back to the login screen.

## Develop

```sh
# 1. API (from apps/api; .dev.vars holds ADMIN_PASSWORD / ADMIN_JWT_SECRET)
npx wrangler dev --port 8787 --ip 127.0.0.1

# 2. Admin (from the repo root). Must be http://localhost:5174 to match CORS.
pnpm dev:admin            # = pnpm --filter @lumen/admin dev
```

Open http://localhost:5174 and sign in (local password: `admin`).

```sh
pnpm --filter @lumen/admin typecheck
pnpm --filter @lumen/admin build      # → apps/admin/dist
```

## Screens

- **Overview**: stats from `GET /stats`, the 8 most recent jobs and the low-stock variants (under 10 units, derived from `GET /products`).
- **Products**: search (`/` focuses it), collection and status filters, all synced to the URL. Expand a row to edit a variant's stock and wholesale cost inline: Enter saves a row, Esc resets it. Each save calls `PATCH /variants/:id` and the toast reports how many stores the change was synced to. You can archive a product (`DELETE`, with a confirm) or restore it (`PUT` with `status: active`).
- **Product editor** (`/products/new`, `/products/:id`): covers details, organization, the variants table and images.
  - Variants: add, duplicate or remove rows. Each row has frame and lens color presets from `@lumen/core/seed`, a live margin and an image.
  - Images: drag-and-drop upload to `POST /images` with progress, alt text, a SKU assignment and reordering (drag handle or the arrow buttons).
  - The form is validated client-side with `productInput.safeParse`, and server `issues` are mapped back onto the fields. Save with ⌘S / Ctrl+S.
  - The page shows how many stores imported the product (`importedBy`). After import, only stock and wholesale cost propagate to stores.
- **Stores**: subscription status, imported count, install and last-sync times, and a per-store **Resync** button (`POST /stores/:id/resync`).
- **Sync jobs**: the latest 200 jobs. The list polls every 5 s while the tab is visible (you can pause it) and can be filtered by status and kind.

All money is integer cents in the API. The UI shows and accepts dollars and converts at the edges (`src/lib/format.ts`).

## Deploy to Cloudflare Pages

- **Build command:** `pnpm --filter @lumen/admin build`
- **Build output directory:** `apps/admin/dist`
- **Root directory:** repository root (so the pnpm workspace and `@lumen/core` resolve)
- **Environment:** `VITE_API_URL=https://<your-api-worker>`, and Node 20+.

SPA routing is handled by `public/_redirects` (`/* /index.html 200`), which Vite copies into `dist`. After deploying, add the Pages origin (for example `https://lumen-admin.pages.dev`) to the API's `CORS_ORIGINS`.

Direct upload alternative:

```sh
pnpm --filter @lumen/admin build
npx wrangler pages deploy apps/admin/dist --project-name lumen-admin
```

## Layout

```
src/
  main.tsx            providers: MotionConfig(reducedMotion=user), router, auth, toasts, confirm
  App.tsx             auth gate + routes + route fade
  api.ts              typed client, token storage, 401 handling, XHR image upload with progress
  styles.css          Tailwind v4 @theme tokens, light/dark via prefers-color-scheme
  lib/                format (money/time), product helpers, useAsync
  components/         Layout, ui primitives, badges, Toast, ConfirmDialog, Segmented,
                      ProductImage (sunglasses placeholder on 404), ColorField, ImageManager, CountUp
  pages/              Login, Overview, Products, ProductEditor, Stores, Jobs, NotFound
```

Fonts (Inter Tight, Instrument Serif) load from Google Fonts in `index.html`, because the Fontsource packages are dependencies of `apps/web` only.
