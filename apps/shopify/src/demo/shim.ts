/**
 * Minimal stand-in for the App Bridge `shopify` global so the app runs outside the Shopify admin.
 * Only installed in demo mode, and only when App Bridge didn't create the real one.
 */
export function installShopifyShim() {
  if (typeof globalThis.shopify !== "undefined" && globalThis.shopify?.toast) return;

  const region = document.createElement("div");
  region.className = "demo-toasts";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);

  let seq = 0;
  const show = (message: string, opts?: { duration?: number; isError?: boolean }) => {
    const id = `toast-${++seq}`;
    const el = document.createElement("div");
    el.className = "demo-toast";
    if (opts?.isError) el.dataset.error = "true";
    el.id = id;
    el.textContent = message;
    region.appendChild(el);
    requestAnimationFrame(() => (el.dataset.visible = "true"));
    setTimeout(() => {
      el.dataset.visible = "false";
      setTimeout(() => el.remove(), 250);
    }, opts?.duration ?? 4000);
    return id;
  };

  const shim = {
    config: { apiKey: "demo", shop: "lumen-demo.myshopify.com", locale: "en-US" },
    origin: window.location.origin,
    ready: Promise.resolve(),
    idToken: async () => "demo-session-token",
    toast: { show, hide: (id: string) => document.getElementById(id)?.remove() },
    loading: () => undefined,
  };
  (globalThis as unknown as { shopify: unknown }).shopify = shim;
}
