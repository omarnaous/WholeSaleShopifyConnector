import { Hono } from "hono";
import { filterProducts, parseFilters, type CatalogResponse, type Product } from "@lumen/core";
import type { AppContext } from "../env";
import { getProductBySlug, listProducts } from "../db/repo";

export const publicRoutes = new Hono<AppContext>();

export function frameColorFacets(products: Product[]) {
  const map = new Map<string, string>();
  for (const p of products) for (const v of p.variants) if (!map.has(v.frameColor)) map.set(v.frameColor, v.frameColorHex);
  return [...map].map(([name, hex]) => ({ name, hex })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Public showcase catalog. Wholesale cost is part of the pitch (store owners compare margin before installing),
 * so it is intentionally exposed here.
 */
publicRoutes.get("/catalog", async (c) => {
  const all = await listProducts(c.env);
  const body: CatalogResponse = { products: filterProducts(all, parseFilters(new URL(c.req.url).searchParams)), facets: { frameColors: frameColorFacets(all) } };
  return c.json(body, 200, { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" });
});

publicRoutes.get("/products/:slug", async (c) => {
  const p = await getProductBySlug(c.env, c.req.param("slug"));
  if (!p || p.status !== "active") return c.json({ error: "Not found" }, 404);
  return c.json(p, 200, { "Cache-Control": "public, max-age=60, s-maxage=300" });
});
