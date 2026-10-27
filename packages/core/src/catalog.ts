export const COLLECTIONS = ["aviator", "wayfarer", "sport", "oversized"] as const;
export const STYLES = ["aviator", "wayfarer", "round", "cat-eye", "shield", "square"] as const;
export const FRAME_MATERIALS = ["acetate", "bio-acetate", "metal", "titanium", "tr90"] as const;
export const LENS_TYPES = ["polarized", "uv400", "mirrored", "gradient"] as const;
export const GENDERS = ["men", "women", "unisex"] as const;

export type Collection = (typeof COLLECTIONS)[number];
export type Style = (typeof STYLES)[number];
export type FrameMaterial = (typeof FRAME_MATERIALS)[number];
export type LensType = (typeof LENS_TYPES)[number];
export type Gender = (typeof GENDERS)[number];

export const LABELS: Record<string, string> = {
  aviator: "Aviator",
  wayfarer: "Wayfarer",
  sport: "Sport",
  oversized: "Oversized",
  round: "Round",
  "cat-eye": "Cat-Eye",
  shield: "Shield",
  square: "Square",
  acetate: "Acetate",
  "bio-acetate": "Bio-Acetate",
  metal: "Metal",
  titanium: "Titanium",
  tr90: "TR90",
  polarized: "Polarized",
  uv400: "UV400",
  mirrored: "Mirrored",
  gradient: "Gradient",
  men: "Men",
  women: "Women",
  unisex: "Unisex",
};

export const label = (key: string) => LABELS[key] ?? key;

/** Money is always integer cents. */
export type Cents = number;

export interface Variant {
  id: string;
  productId: string;
  sku: string;
  frameColor: string;
  frameColorHex: string;
  lensColor: string;
  lensColorHex: string;
  size: string;
  stock: number;
  wholesaleCost: Cents;
  suggestedPrice: Cents;
  imageUrl: string | null;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  variantId: string | null;
  position: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  collection: Collection;
  style: Style;
  frameMaterial: FrameMaterial;
  lensTypes: LensType[];
  gender: Gender;
  status: "active" | "archived";
  variants: Variant[];
  images: ProductImage[];
  updatedAt: string;
}

export interface CatalogFilters {
  q?: string;
  collection?: Collection[];
  style?: Style[];
  frameColor?: string[];
  lensType?: LensType[];
  gender?: Gender[];
  inStock?: boolean;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Pure filter used by the API and by the website's offline fallback. */
export function filterProducts(products: Product[], f: CatalogFilters): Product[] {
  const q = f.q?.trim().toLowerCase();
  return products.filter((p) => {
    if (p.status !== "active") return false;
    if (q) {
      const hay = [p.name, p.description, p.style, p.collection, p.frameMaterial, ...p.variants.flatMap((v) => [v.sku, v.frameColor, v.lensColor])]
        .join(" ")
        .toLowerCase();
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    if (f.collection?.length && !f.collection.includes(p.collection)) return false;
    if (f.style?.length && !f.style.includes(p.style)) return false;
    if (f.gender?.length && !f.gender.includes(p.gender) && !(p.gender === "unisex")) return false;
    if (f.lensType?.length && !f.lensType.some((l) => p.lensTypes.includes(l))) return false;
    if (f.frameColor?.length) {
      const wanted = f.frameColor.map((c) => c.toLowerCase());
      if (!p.variants.some((v) => wanted.includes(v.frameColor.toLowerCase()))) return false;
    }
    if (f.inStock && !p.variants.some((v) => v.stock > 0)) return false;
    return true;
  });
}

export function priceRange(p: Pick<Product, "variants">) {
  const costs = p.variants.map((v) => v.wholesaleCost);
  const prices = p.variants.map((v) => v.suggestedPrice);
  return {
    minCost: Math.min(...costs),
    maxCost: Math.max(...costs),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    totalStock: p.variants.reduce((n, v) => n + v.stock, 0),
  };
}

export const formatMoney = (cents: Cents, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);

export const CATALOG_FILTER_KEYS = ["collection", "style", "frameColor", "lensType", "gender"] as const;

/** URLSearchParams → CatalogFilters. Multi-values are comma separated: ?lensType=polarized,mirrored */
export function parseFilters(sp: URLSearchParams): CatalogFilters {
  const list = (k: string) => sp.get(k)?.split(",").map((v) => v.trim()).filter(Boolean);
  return {
    q: sp.get("q") ?? undefined,
    collection: list("collection") as Collection[] | undefined,
    style: list("style") as Style[] | undefined,
    frameColor: list("frameColor"),
    lensType: list("lensType") as LensType[] | undefined,
    gender: list("gender") as Gender[] | undefined,
    inStock: sp.get("inStock") === "1" || undefined,
  };
}

export function filtersToSearch(f: CatalogFilters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  for (const k of CATALOG_FILTER_KEYS) {
    const v = f[k];
    if (v?.length) sp.set(k, v.join(","));
  }
  if (f.inStock) sp.set("inStock", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}
