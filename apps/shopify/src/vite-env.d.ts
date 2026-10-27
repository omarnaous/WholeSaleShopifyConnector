/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Shopify app client id; injected into the `shopify-api-key` meta tag in index.html. */
  readonly VITE_SHOPIFY_API_KEY?: string;
  /** "1" serves fixtures from src/demo instead of calling the API (local preview without Shopify). */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
