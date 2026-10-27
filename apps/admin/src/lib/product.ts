import { priceRange, type Product, type ProductInput } from "@lumen/core";

/** Full PUT body from a loaded product (used for status flips like Restore). */
export function productToInput(p: Product, patch: Partial<ProductInput> = {}): ProductInput {
  const skuById = new Map(p.variants.map((v) => [v.id, v.sku]));
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    collection: p.collection,
    style: p.style,
    frameMaterial: p.frameMaterial,
    lensTypes: p.lensTypes,
    gender: p.gender,
    status: p.status,
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      frameColor: v.frameColor,
      frameColorHex: v.frameColorHex,
      lensColor: v.lensColor,
      lensColorHex: v.lensColorHex,
      size: v.size,
      stock: v.stock,
      wholesaleCost: v.wholesaleCost,
      suggestedPrice: v.suggestedPrice,
      imageUrl: v.imageUrl,
    })),
    images: [...p.images]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ url: i.url, alt: i.alt, variantSku: i.variantId ? (skuById.get(i.variantId) ?? null) : null })),
    ...patch,
  };
}

export function productSummary(p: Product) {
  if (!p.variants.length) return { minCost: 0, maxCost: 0, minPrice: 0, maxPrice: 0, totalStock: 0 };
  return priceRange(p);
}

export const coverImage = (p: Product) => [...p.images].sort((a, b) => a.position - b.position)[0]?.url ?? p.variants.find((v) => v.imageUrl)?.imageUrl ?? null;
