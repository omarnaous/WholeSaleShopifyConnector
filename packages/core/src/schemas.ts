import { z } from "zod";
import { COLLECTIONS, FRAME_MATERIALS, GENDERS, LENS_TYPES, STYLES } from "./catalog";

/**
 * Runtime validation lives in its own entry ("@lumen/core/schemas") so zod never ships
 * in bundles that only need types and helpers (website, embedded app).
 */
export const variantInput = z.object({
  id: z.string().optional(),
  sku: z.string().min(1).max(64),
  frameColor: z.string().min(1).max(40),
  frameColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  lensColor: z.string().min(1).max(40),
  lensColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  size: z.string().min(1).max(12),
  stock: z.number().int().min(0),
  wholesaleCost: z.number().int().min(0),
  suggestedPrice: z.number().int().min(0),
  imageUrl: z.string().nullable().optional(),
});

export const productInput = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().max(4000).default(""),
  collection: z.enum(COLLECTIONS),
  style: z.enum(STYLES),
  frameMaterial: z.enum(FRAME_MATERIALS),
  lensTypes: z.array(z.enum(LENS_TYPES)).min(1),
  gender: z.enum(GENDERS),
  status: z.enum(["active", "archived"]).default("active"),
  variants: z.array(variantInput).min(1).max(100),
  images: z
    .array(z.object({ url: z.string(), alt: z.string().default(""), variantSku: z.string().nullable().optional() }))
    .default([]),
});

export type ProductInput = z.infer<typeof productInput>;
export type VariantInput = z.infer<typeof variantInput>;
