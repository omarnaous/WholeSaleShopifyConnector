import { useEffect, useState } from "react";
import { COLLECTIONS, type Collection, type Product } from "@lumen/core";

const API = import.meta.env.VITE_API_URL as string | undefined;

let cache: Promise<Product[]> | null = null;

/**
 * Live catalog from the API (wholesaler edits show up within minutes thanks to s-maxage),
 * with the bundled seed as an offline fallback so the showcase never renders empty.
 */
export function loadCatalog(): Promise<Product[]> {
  cache ??= (async () => {
    if (API) {
      try {
        const res = await fetch(`${API}/api/public/catalog`, { headers: { accept: "application/json" } });
        if (res.ok) {
          const body = (await res.json()) as { products: Product[] };
          if (body.products.length) return body.products;
        }
      } catch {
        /* fall through to seed */
      }
    }
    const { seedProducts } = await import("@lumen/core/seed");
    return seedProducts();
  })();
  return cache;
}

export function useCatalog() {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let alive = true;
    loadCatalog().then((p) => alive && setProducts(p));
    return () => {
      alive = false;
    };
  }, []);
  return products;
}

/**
 * Product shots are rendered at build time into /products/<name>{,-sm}.{avif,webp}.
 * API image URLs (R2) for the same shot are mapped back to the local, CDN-cached file.
 * Anything else (fresh wholesaler uploads) is used as-is.
 */
export function shotSources(url: string | null | undefined) {
  if (!url) return null;
  const m = url.match(/products\/([a-z0-9-]+)\.(webp|avif|png|jpe?g)$/);
  if (!m) return { fallback: url };
  const base = `/products/${m[1]}`;
  return {
    avif: `${base}-sm.avif 600w, ${base}.avif 1200w`,
    webp: `${base}-sm.webp 600w, ${base}.webp 1200w`,
    fallback: `${base}.webp`,
  };
}

export const COLLECTION_META: Record<Collection, { title: string; tint: string; tintName: string; line: string; index: string }> = {
  aviator: { title: "Aviator", tint: "#c8892b", tintName: "Amber", line: "Metal & titanium pilots, built for long light.", index: "01" },
  wayfarer: { title: "Wayfarer", tint: "#4d6b52", tintName: "G-15", line: "Hand-polished acetate. The everyday icon.", index: "02" },
  sport: { title: "Sport", tint: "#4f86c6", tintName: "Azure Mirror", line: "Shields and wraps for speed, salt and altitude.", index: "03" },
  oversized: { title: "Oversized", tint: "#d98c8c", tintName: "Rosé", line: "Statement frames for entrances, not exits.", index: "04" },
};
export const COLLECTION_ORDER = COLLECTIONS;
