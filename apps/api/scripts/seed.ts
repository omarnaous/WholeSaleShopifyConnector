/**
 * Prints SQL that seeds the demo catalog. Image keys point at R2 objects uploaded by upload-images.ts.
 *   pnpm db:seed:local
 */
import { seedProducts } from "@lumen/core/seed";

const q = (v: unknown) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const lines: string[] = ["DELETE FROM images;", "DELETE FROM variants;", "DELETE FROM products;"];
for (const p of seedProducts("products")) {
  lines.push(
    `INSERT INTO products (id, slug, name, description, collection, style, frame_material, lens_types, gender, status, updated_at) VALUES (${[p.id, p.slug, p.name, p.description, p.collection, p.style, p.frameMaterial, JSON.stringify(p.lensTypes), p.gender, p.status, p.updatedAt].map(q).join(", ")});`,
  );
  p.variants.forEach((v, i) => {
    lines.push(
      `INSERT INTO variants (id, product_id, sku, frame_color, frame_color_hex, lens_color, lens_color_hex, size, stock, wholesale_cost, suggested_price, image_key, position) VALUES (${[v.id, p.id, v.sku, v.frameColor, v.frameColorHex, v.lensColor, v.lensColorHex, v.size, v.stock, v.wholesaleCost, v.suggestedPrice, v.imageUrl, i].map(q).join(", ")});`,
    );
  });
  for (const img of p.images) lines.push(`INSERT INTO images (id, product_id, variant_id, key, alt, position) VALUES (${[img.id, p.id, img.variantId, img.url, img.alt, img.position].map(q).join(", ")});`);
}
console.log(lines.join("\n"));
