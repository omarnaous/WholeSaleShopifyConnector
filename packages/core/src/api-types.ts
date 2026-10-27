import type { Cents, Product } from "./catalog";
import type { SubscriptionStatus } from "./rules";

export interface CatalogResponse {
  products: Product[];
  facets: { frameColors: { name: string; hex: string }[] };
}

/** Catalog item as seen by a subscriber store: adds import state. */
export interface AppCatalogProduct extends Product {
  imported: null | { status: "ACTIVE" | "DRAFT" | "ORPHANED"; shopifyProductId: string; importedAt: string };
}

export interface ShopState {
  shop: string;
  subscription: { status: SubscriptionStatus; currentPeriodEnd: string | null; trialDays: number; test: boolean };
  plan: { name: string; price: Cents; currency: string; trialDays: number };
  importedCount: number;
  openAlerts: number;
  location: { id: string; name: string } | null;
}

export interface ImportJobState {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  total: number;
  done: number;
  failed: number;
  errors: { productId: string; message: string }[];
}

export interface ImportedRow {
  productId: string;
  name: string;
  imageUrl: string | null;
  shopifyProductId: string;
  status: "ACTIVE" | "DRAFT" | "ORPHANED";
  variants: { sku: string; label: string; stock: number; cost: Cents; price: Cents | null; marginAlert: boolean }[];
  lastSyncedAt: string | null;
}

export interface MarginAlertRow {
  id: string;
  productName: string;
  sku: string;
  variantLabel: string;
  cost: Cents;
  price: Cents;
  shopifyProductId: string;
  createdAt: string;
}

export interface AdminStoreRow {
  id: string;
  shop: string;
  subscriptionStatus: SubscriptionStatus;
  importedProducts: number;
  installedAt: string;
  uninstalledAt: string | null;
  lastSyncAt: string | null;
}

export interface AdminJobRow {
  id: string;
  kind: "import" | "sync" | "status";
  shop: string;
  productName: string | null;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AdminStats {
  products: number;
  variants: number;
  activeStores: number;
  totalStores: number;
  importedProducts: number;
  lowStockVariants: number;
  jobs24h: { done: number; failed: number };
}
