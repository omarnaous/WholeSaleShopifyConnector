import { describe, expect, it } from "vitest";
import { changedSyncFields, isMarginAlert, isSubscriptionActive, productStatusFor } from "./rules";
import { filterProducts, type Product } from "./catalog";

describe("subscription → product status", () => {
  it("activates only on ACTIVE", () => {
    expect(productStatusFor("ACTIVE")).toBe("ACTIVE");
    expect(isSubscriptionActive("ACTIVE")).toBe(true);
    expect(isSubscriptionActive("ACCEPTED")).toBe(false);
  });
  it("drafts on cancel, unpaid (frozen), expired, declined", () => {
    for (const s of ["CANCELLED", "FROZEN", "EXPIRED", "DECLINED"] as const) expect(productStatusFor(s)).toBe("DRAFT");
  });
  it("leaves products alone while pending", () => {
    expect(productStatusFor("PENDING")).toBeNull();
    expect(productStatusFor("ACCEPTED")).toBeNull();
  });
});

describe("margin alert", () => {
  it("fires when cost reaches selling price", () => {
    expect(isMarginAlert(5000, 4999)).toBe(true);
    expect(isMarginAlert(5000, 5000)).toBe(true);
    expect(isMarginAlert(4000, 5000)).toBe(false);
    expect(isMarginAlert(4000, null)).toBe(false);
  });
});

describe("sync fields", () => {
  it("only reports stock and cost", () => {
    expect(changedSyncFields({ stock: 1, wholesaleCost: 100 }, { stock: 2, wholesaleCost: 100 })).toEqual(["stock"]);
    expect(changedSyncFields({ stock: 1, wholesaleCost: 100 }, { stock: 1, wholesaleCost: 120 })).toEqual(["wholesaleCost"]);
    expect(changedSyncFields({ stock: 1, wholesaleCost: 100 }, { stock: 1, wholesaleCost: 100 })).toEqual([]);
  });
});

describe("filterProducts", () => {
  const base: Product = {
    id: "p1",
    slug: "a",
    name: "Riviera",
    description: "",
    collection: "aviator",
    style: "aviator",
    frameMaterial: "metal",
    lensTypes: ["polarized"],
    gender: "men",
    status: "active",
    images: [],
    updatedAt: "",
    variants: [
      { id: "v", productId: "p1", sku: "RIV-GLD", frameColor: "Gold", frameColorHex: "#c9a14a", lensColor: "Green", lensColorHex: "#2f4f3a", size: "58", stock: 0, wholesaleCost: 1, suggestedPrice: 2, imageUrl: null },
    ],
  };
  it("filters by lens type, frame color and search", () => {
    expect(filterProducts([base], { lensType: ["mirrored"] })).toHaveLength(0);
    expect(filterProducts([base], { frameColor: ["gold"] })).toHaveLength(1);
    expect(filterProducts([base], { q: "riv gold" })).toHaveLength(1);
    expect(filterProducts([base], { inStock: true })).toHaveLength(0);
  });
});
