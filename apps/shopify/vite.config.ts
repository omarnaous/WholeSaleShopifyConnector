import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * In production the Cloudflare Worker (apps/api) serves `dist/` as static assets on the same origin as
 * `/api/*`, so every request is relative. In dev, `wrangler dev` runs on :8787 and we proxy to it.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/webhooks": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/img": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // dist/ is served publicly by the worker; keep maps out of it.
    sourcemap: false,
  },
});
