import type { AdminJobRow, AdminStats, AdminStoreRow, Product, ProductInput } from "@lumen/core";

export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8787").replace(/\/+$/, "");

const TOKEN_KEY = "lumen.admin.token";

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  },
  set(t: string | null) {
    memoryToken = t;
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: keep it in memory for this tab */
    }
  },
};
let memoryToken: string | null = null;

/** Called on any 401 so the app can drop the session and route to /login. */
let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export interface ApiIssue {
  path: (string | number)[];
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: ApiIssue[],
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/admin${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(`Can't reach the API at ${API_URL}`, 0);
  }
  if (res.status === 401 && !path.endsWith("/login")) {
    tokenStore.set(null);
    onUnauthorized();
    throw new ApiError("Session expired — please sign in again", 401);
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new ApiError((data as { error?: string } | null)?.error ?? `Request failed (${res.status})`, res.status, (data as { issues?: ApiIssue[] } | null)?.issues);
  }
  return data as T;
}

export type AdminProduct = Product & { importedBy?: number };

export const api = {
  login: (password: string) => request<{ token: string }>("POST", "/login", { password }),
  stats: () => request<AdminStats>("GET", "/stats"),
  products: () => request<Product[]>("GET", "/products"),
  product: (id: string) => request<AdminProduct>("GET", `/products/${encodeURIComponent(id)}`),
  createProduct: (input: ProductInput) => request<Product>("POST", "/products", input),
  updateProduct: (id: string, input: ProductInput) => request<{ product: Product; syncJobsQueued: number }>("PUT", `/products/${encodeURIComponent(id)}`, input),
  archiveProduct: (id: string) => request<{ ok: true }>("DELETE", `/products/${encodeURIComponent(id)}`),
  patchVariant: (id: string, patch: { stock?: number; wholesaleCost?: number; suggestedPrice?: number }) =>
    request<{ ok: true; syncJobsQueued: number }>("PATCH", `/variants/${encodeURIComponent(id)}`, patch),
  stores: () => request<AdminStoreRow[]>("GET", "/stores"),
  resyncStore: (id: string) => request<{ queued: number }>("POST", `/stores/${encodeURIComponent(id)}/resync`),
  jobs: () => request<AdminJobRow[]>("GET", "/jobs"),
};

/** Multipart upload with progress (fetch has no upload progress, so XHR). */
export function uploadImage(file: File, onProgress?: (pct: number) => void): Promise<{ key: string; url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/admin/images`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError("Upload failed — network error", 0));
    xhr.onload = () => {
      let data: { key?: string; url?: string; error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status === 401) {
        tokenStore.set(null);
        onUnauthorized();
        return reject(new ApiError("Session expired", 401));
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.url && data.key) return resolve({ key: data.key, url: data.url });
      reject(new ApiError(data?.error ?? `Upload failed (${xhr.status})`, xhr.status));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
