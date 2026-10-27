/**
 * Thin client for the embedded-app API (`/api/app/*` on the same origin as this page).
 *
 * - Adds `Authorization: Bearer <App Bridge session token>` to every request. App Bridge v4 already injects
 *   it into same-origin `fetch` calls, but being explicit keeps this working if that behaviour changes.
 * - Retries once on 401 with a fresh token (tokens live ~60s; the API sends X-Shopify-Retry-Invalid-Session-Request).
 * - On 402 `SUBSCRIPTION_REQUIRED` notifies the app so it can route to Plan & billing.
 * - In demo mode (VITE_DEMO=1 or ?demo=1) requests are answered by fixtures in src/demo, loaded lazily so the
 *   production bundle never executes them.
 */
import type { AppCatalogProduct, CatalogFilters, ImportJobState, ImportedRow, MarginAlertRow, ShopState } from "@lumen/core";
import { filtersToSearch } from "@lumen/core";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const DEMO_KEY = "lumen-demo";

/** Latched once per tab so client-side navigation (which drops the query string) stays in demo mode. */
export const isDemo: boolean = (() => {
  if (import.meta.env.VITE_DEMO === "1") return true;
  try {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      sessionStorage.setItem(DEMO_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
})();

type Fetcher = (path: string, init: RequestInit) => Promise<Response>;

let demoFetcher: Promise<Fetcher> | null = null;
const transport = (): Promise<Fetcher> => {
  if (!isDemo) return Promise.resolve((path, init) => fetch(path, init));
  demoFetcher ??= import("./demo/server").then((m) => m.demoFetch);
  return demoFetcher;
};

let onSubscriptionRequired: (() => void) | null = null;
/** Registered by <App>: called whenever the API answers 402 SUBSCRIPTION_REQUIRED. */
export function setSubscriptionRequiredHandler(fn: (() => void) | null) {
  onSubscriptionRequired = fn;
}

async function sessionToken(): Promise<string> {
  return globalThis.shopify ? await shopify.idToken() : "";
}

/** `path` is relative to /api/app. */
export async function request<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const send = await transport();
  const attempt = async () => {
    const headers = new Headers({ Accept: "application/json" });
    const token = await sessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    return send(`/api/app${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  };

  let res = await attempt();
  if (res.status === 401) res = await attempt();

  const data: unknown = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string };
    if (res.status === 402 && err.code === "SUBSCRIPTION_REQUIRED") onSubscriptionRequired?.();
    throw new ApiError(res.status, err.error ?? `Request failed (${res.status})`, err.code);
  }
  return data as T;
}

export interface CatalogResult {
  products: AppCatalogProduct[];
  facets: { frameColors: { name: string; hex: string }[] };
}

export const api = {
  state: () => request<ShopState>("/state"),
  subscribe: () => request<{ confirmationUrl: string }>("/billing/subscribe", { method: "POST" }),
  cancel: () => request<{ ok: true }>("/billing/cancel", { method: "POST" }),
  catalog: (filters: CatalogFilters, signal?: AbortSignal) => request<CatalogResult>(`/catalog${filtersToSearch(filters)}`, { signal }),
  importProducts: (body: { productIds: string[] } | { all: true }) =>
    request<{ jobId: string | null; skipped: number }>("/import", { method: "POST", body }),
  importJob: (id: string) => request<ImportJobState>(`/import/${encodeURIComponent(id)}`),
  imported: () => request<ImportedRow[]>("/imported"),
  alerts: () => request<MarginAlertRow[]>("/alerts"),
  dismissAlert: (id: string) => request<{ ok: true }>(`/alerts/${encodeURIComponent(id)}/dismiss`, { method: "POST" }),
  /** Unauthenticated showcase endpoint; used on the paywall where /api/app/catalog is still locked. */
  publicCatalogSize: async () => {
    const send = await transport();
    const res = await send("/api/public/catalog", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new ApiError(res.status, "Catalog unavailable");
    return ((await res.json()) as { products: unknown[] }).products.length;
  },
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
