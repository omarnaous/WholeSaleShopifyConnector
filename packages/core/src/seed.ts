import type { Collection, FrameMaterial, Gender, LensType, Product, Style, Variant } from "./catalog";
import { slugify } from "./catalog";

export const FRAME_COLORS = {
  Black: "#0d0d0f",
  "Matte Black": "#1c1c1e",
  Tortoise: "#6b4426",
  Gold: "#c9a14a",
  Silver: "#b9bcc2",
  Gunmetal: "#4a4d52",
  Crystal: "#d9dde0",
  Ivory: "#efe6d6",
  Olive: "#4f5a3a",
  Burgundy: "#5e1f2a",
  Navy: "#1d2a44",
  "Rose Gold": "#c98f7a",
} as const;

export const LENS_COLORS = {
  "G15 Green": "#2f4a35",
  Smoke: "#2a2d31",
  Brown: "#5a3d24",
  Amber: "#c8892b",
  Rose: "#d98c8c",
  "Blue Mirror": "#3a6ea5",
  "Silver Mirror": "#b8c3cc",
  "Gold Mirror": "#d4a640",
  "Violet Gradient": "#6b4c8a",
  "Blue Gradient": "#3b5f84",
  "Sun Yellow": "#e0c04a",
  "Ember Mirror": "#c2412d",
} as const;

type FrameName = keyof typeof FRAME_COLORS;
type LensName = keyof typeof LENS_COLORS;

interface SeedDef {
  name: string;
  collection: Collection;
  style: Style;
  material: FrameMaterial;
  lenses: LensType[];
  gender: Gender;
  cost: number;
  price: number;
  size: string;
  blurb: string;
  combos: [FrameName, LensName][];
}

const DEFS: SeedDef[] = [
  // Aviator
  { name: "Riviera", collection: "aviator", style: "aviator", material: "metal", lenses: ["polarized", "uv400"], gender: "unisex", cost: 2800, price: 8900, size: "58", blurb: "A teardrop aviator in brushed metal with a double bridge and spring hinges. Built for long drives along the coast.", combos: [["Gold", "G15 Green"], ["Silver", "Blue Mirror"], ["Gunmetal", "Smoke"]] },
  { name: "Altitude", collection: "aviator", style: "aviator", material: "titanium", lenses: ["polarized", "mirrored", "uv400"], gender: "men", cost: 4200, price: 13900, size: "60", blurb: "Featherweight titanium aviator with mirrored polarized lenses. Weighs less than a letter.", combos: [["Silver", "Silver Mirror"], ["Gold", "Gold Mirror"], ["Matte Black", "Ember Mirror"]] },
  { name: "Mirage", collection: "aviator", style: "aviator", material: "metal", lenses: ["gradient", "uv400"], gender: "women", cost: 2600, price: 7900, size: "57", blurb: "A softer, rounder aviator with gradient lenses that fade from tint to clear.", combos: [["Rose Gold", "Rose"], ["Gold", "Brown"], ["Silver", "Violet Gradient"]] },
  { name: "Concorde", collection: "aviator", style: "aviator", material: "metal", lenses: ["polarized", "uv400"], gender: "men", cost: 3100, price: 9900, size: "61", blurb: "An oversized pilot frame with a brow bar, made for wide faces and big statements.", combos: [["Gunmetal", "G15 Green"], ["Gold", "Brown"]] },
  { name: "Saint-Tropez", collection: "aviator", style: "aviator", material: "titanium", lenses: ["gradient", "uv400"], gender: "unisex", cost: 3900, price: 12500, size: "58", blurb: "A thin titanium aviator with warm amber gradient lenses that make everything look like golden hour.", combos: [["Gold", "Amber"], ["Silver", "Blue Gradient"], ["Rose Gold", "Rose"]] },
  { name: "Jetstream", collection: "aviator", style: "aviator", material: "metal", lenses: ["mirrored", "uv400"], gender: "unisex", cost: 2400, price: 6900, size: "59", blurb: "A navigator shape with a flat top and a full mirror finish. Loud on purpose.", combos: [["Silver", "Blue Mirror"], ["Black", "Ember Mirror"], ["Gold", "Gold Mirror"]] },
  // Wayfarer
  { name: "Noir", collection: "wayfarer", style: "wayfarer", material: "acetate", lenses: ["polarized", "uv400"], gender: "unisex", cost: 2200, price: 7500, size: "52", blurb: "The classic: a hand-polished acetate wayfarer with steel-core temples and seven-barrel hinges.", combos: [["Black", "G15 Green"], ["Tortoise", "Brown"], ["Crystal", "Smoke"]] },
  { name: "Brera", collection: "wayfarer", style: "wayfarer", material: "bio-acetate", lenses: ["uv400"], gender: "unisex", cost: 2500, price: 8500, size: "54", blurb: "A plant-based acetate wayfarer with a slightly thicker brow. Milan, made easy.", combos: [["Ivory", "Brown"], ["Olive", "G15 Green"], ["Black", "Smoke"]] },
  { name: "Kyoto", collection: "wayfarer", style: "round", material: "acetate", lenses: ["polarized", "uv400"], gender: "unisex", cost: 2700, price: 9200, size: "49", blurb: "A keyhole-bridge round frame with a quiet, scholarly attitude.", combos: [["Tortoise", "G15 Green"], ["Black", "Amber"], ["Crystal", "Rose"]] },
  { name: "Soho", collection: "wayfarer", style: "square", material: "acetate", lenses: ["gradient", "uv400"], gender: "women", cost: 2300, price: 7900, size: "53", blurb: "A softened square with a beveled front that catches the light at every angle.", combos: [["Burgundy", "Rose"], ["Tortoise", "Brown"], ["Black", "Violet Gradient"]] },
  { name: "Harbor", collection: "wayfarer", style: "wayfarer", material: "tr90", lenses: ["polarized", "uv400"], gender: "men", cost: 1500, price: 4900, size: "55", blurb: "A flexible TR90 wayfarer that survives pockets, sand and small children.", combos: [["Navy", "Blue Mirror"], ["Matte Black", "Smoke"], ["Olive", "G15 Green"]] },
  { name: "Marais", collection: "wayfarer", style: "round", material: "bio-acetate", lenses: ["uv400"], gender: "women", cost: 2600, price: 8900, size: "50", blurb: "A slim panto shape in milky bio-acetate. Paris café, any city.", combos: [["Ivory", "Amber"], ["Crystal", "Blue Gradient"]] },
  // Sport
  { name: "Velocity", collection: "sport", style: "shield", material: "tr90", lenses: ["polarized", "mirrored", "uv400"], gender: "unisex", cost: 2900, price: 10900, size: "One", blurb: "A one-piece shield lens with a vented nose pad. For descents that start before sunrise.", combos: [["Matte Black", "Ember Mirror"], ["Silver", "Blue Mirror"], ["Black", "Sun Yellow"]] },
  { name: "Apex", collection: "sport", style: "shield", material: "tr90", lenses: ["mirrored", "uv400"], gender: "men", cost: 2400, price: 8900, size: "One", blurb: "A semi-rimless performance shield with grippy temples and interchangeable lenses.", combos: [["Matte Black", "Silver Mirror"], ["Navy", "Blue Mirror"], ["Olive", "Gold Mirror"]] },
  { name: "Tempo", collection: "sport", style: "wayfarer", material: "tr90", lenses: ["polarized", "uv400"], gender: "unisex", cost: 1800, price: 6500, size: "56", blurb: "A wrap-around wayfarer for running: light, no bounce, polarized.", combos: [["Matte Black", "Smoke"], ["Crystal", "Blue Mirror"], ["Navy", "Ember Mirror"]] },
  { name: "Glacier", collection: "sport", style: "shield", material: "titanium", lenses: ["mirrored", "polarized", "uv400"], gender: "unisex", cost: 4500, price: 15900, size: "One", blurb: "High-altitude glacier lenses with side shields and titanium arms. Expedition-grade.", combos: [["Gunmetal", "Silver Mirror"], ["Black", "Gold Mirror"]] },
  { name: "Sprint", collection: "sport", style: "square", material: "tr90", lenses: ["uv400"], gender: "women", cost: 1600, price: 5500, size: "54", blurb: "A narrow, fast-looking square frame with high-contrast lenses for trail running.", combos: [["Crystal", "Rose"], ["Matte Black", "Sun Yellow"], ["Navy", "Blue Gradient"]] },
  { name: "Draft", collection: "sport", style: "shield", material: "tr90", lenses: ["mirrored", "uv400"], gender: "men", cost: 2100, price: 7900, size: "One", blurb: "A cycling shield with a full-width lens and adjustable nose. Clears the helmet, cuts the wind.", combos: [["Matte Black", "Ember Mirror"], ["Silver", "Silver Mirror"]] },
  // Oversized
  { name: "Capri", collection: "oversized", style: "cat-eye", material: "acetate", lenses: ["gradient", "uv400"], gender: "women", cost: 2600, price: 9500, size: "56", blurb: "A dramatic cat-eye with lifted corners and a thick acetate front. Built for an entrance.", combos: [["Black", "Smoke"], ["Tortoise", "Brown"], ["Burgundy", "Rose"]] },
  { name: "Monaco", collection: "oversized", style: "square", material: "acetate", lenses: ["gradient", "uv400"], gender: "women", cost: 2800, price: 9900, size: "58", blurb: "An oversized square with a beveled frame: half shield, half sculpture.", combos: [["Ivory", "Brown"], ["Black", "Violet Gradient"], ["Tortoise", "Amber"]] },
  { name: "Portofino", collection: "oversized", style: "round", material: "bio-acetate", lenses: ["polarized", "uv400"], gender: "women", cost: 2700, price: 9200, size: "57", blurb: "Big round lenses in bio-acetate with a keyhole bridge and gold rivets.", combos: [["Tortoise", "G15 Green"], ["Crystal", "Rose"], ["Black", "Smoke"]] },
  { name: "Hollywood", collection: "oversized", style: "square", material: "acetate", lenses: ["polarized", "uv400"], gender: "unisex", cost: 3000, price: 10900, size: "59", blurb: "A thick, flat-top square for the incognito look that everyone notices anyway.", combos: [["Black", "Smoke"], ["Tortoise", "Brown"], ["Olive", "G15 Green"]] },
  { name: "Positano", collection: "oversized", style: "cat-eye", material: "bio-acetate", lenses: ["gradient", "uv400"], gender: "women", cost: 2500, price: 8900, size: "55", blurb: "A softened cat-eye in warm colors, inspired by cliffside villas and late lunches.", combos: [["Ivory", "Amber"], ["Burgundy", "Rose"], ["Navy", "Blue Gradient"]] },
  { name: "Eclipse", collection: "oversized", style: "shield", material: "metal", lenses: ["mirrored", "uv400"], gender: "unisex", cost: 3300, price: 11900, size: "One", blurb: "A single-lens mask with a hidden metal frame. Part runway, part sci-fi.", combos: [["Silver", "Silver Mirror"], ["Gold", "Gold Mirror"], ["Black", "Violet Gradient"]] },
];

const short = (s: string) =>
  s
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .map((w) => w.slice(0, 3))
    .join("")
    .toUpperCase();

/** Deterministic pseudo-random so the seed is stable between runs. */
function rand(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

export function seedProducts(imageBase = "/products"): Product[] {
  const r = rand(42);
  return DEFS.map((d, i) => {
    const slug = slugify(d.name);
    const id = `prd_${slug}`;
    const variants: Variant[] = d.combos.map(([frame, lens], j) => {
      const key = `${slugify(frame)}-${slugify(lens)}`;
      const stock = Math.round(r() * 220) * (r() < 0.12 ? 0 : 1);
      return {
        id: `var_${slug}_${key}`,
        productId: id,
        sku: `LUM-${short(d.name)}-${short(frame).slice(0, 3)}${short(lens).slice(0, 3)}`,
        frameColor: frame,
        frameColorHex: FRAME_COLORS[frame],
        lensColor: lens,
        lensColorHex: LENS_COLORS[lens],
        size: d.size,
        stock,
        wholesaleCost: d.cost + (j === 0 ? 0 : Math.round(r() * 3) * 100),
        suggestedPrice: d.price,
        imageUrl: `${imageBase}/${slug}-${key}.webp`,
      };
    });
    return {
      id,
      slug,
      name: d.name,
      description: d.blurb,
      collection: d.collection,
      style: d.style,
      frameMaterial: d.material,
      lensTypes: d.lenses,
      gender: d.gender,
      status: "active",
      variants,
      images: variants.map((v, k) => ({ id: `img_${v.id}`, url: v.imageUrl!, alt: `${d.name} sunglasses, ${v.frameColor} frame with ${v.lensColor} lenses`, variantId: v.id, position: k })),
      updatedAt: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
    };
  });
}
