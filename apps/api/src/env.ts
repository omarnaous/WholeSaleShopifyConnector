import type { JobMessage } from "./jobs/messages";

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  JOBS: Queue<JobMessage>;
  ASSETS: Fetcher;

  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_API_VERSION: string;
  SHOPIFY_APP_HANDLE: string;
  ADMIN_PASSWORD: string;
  ADMIN_JWT_SECRET: string;

  /** Absolute origin of this worker. Shopify pulls product images from here, so it must be public. */
  PUBLIC_URL: string;
  CORS_ORIGINS: string;
  /** "on" when the zone has Cloudflare Image Transformations enabled (AVIF/WebP + resize). */
  IMAGE_TRANSFORMS: string;
  BILLING_TEST: string;
  /** Local dev only: route Admin API calls to scripts/mock-shopify.ts. Never set in production. */
  SHOPIFY_ADMIN_ORIGIN?: string;
}

export type AppContext = { Bindings: Env; Variables: { shop: string } };
