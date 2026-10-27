export class ShopifyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** The token was revoked (app uninstalled) — stop retrying. */
export class ShopifyAuthError extends ShopifyError {}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: { cost?: { requestedQueryCost: number; throttleStatus: { currentlyAvailable: number; restoreRate: number } } };
}

export interface AdminClient {
  shop: string;
  request<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimal Admin GraphQL client with cost-based throttle backoff.
 * Shopify returns THROTTLED with HTTP 200 when the bucket is empty; we wait for the bucket to refill.
 */
export function adminClient(shop: string, accessToken: string, apiVersion: string, origin = `https://${shop}`): AdminClient {
  const url = `${origin}/admin/api/${apiVersion}/graphql.json`;
  return {
    shop,
    async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      for (let attempt = 0; attempt < 6; attempt++) {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
          body: JSON.stringify({ query, variables }),
        });
        if (res.status === 401 || res.status === 403) throw new ShopifyAuthError(`Shopify auth failed for ${shop}`, res.status);
        if (res.status === 429 || res.status >= 500) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        const body = (await res.json()) as GraphQLResponse<T>;
        const throttled = body.errors?.some((e) => e.extensions?.code === "THROTTLED");
        if (throttled) {
          const t = body.extensions?.cost;
          const wait = t ? Math.ceil(((t.requestedQueryCost - t.throttleStatus.currentlyAvailable) / t.throttleStatus.restoreRate) * 1000) : 1000;
          await sleep(Math.max(wait, 250));
          continue;
        }
        if (body.errors?.length) throw new ShopifyError(body.errors.map((e) => e.message).join("; "), res.status, body.errors);
        if (!body.data) throw new ShopifyError("Empty GraphQL response", res.status);
        return body.data;
      }
      throw new ShopifyError(`Shopify request kept failing for ${shop}`);
    },
  };
}

export function assertNoUserErrors(errors: { field?: string[] | null; message: string }[] | undefined, context: string) {
  if (errors?.length) throw new ShopifyError(`${context}: ${errors.map((e) => (e.field ? `${e.field.join(".")}: ` : "") + e.message).join("; ")}`, 422, errors);
}

/**
 * Shop origin. SHOPIFY_ADMIN_ORIGIN is a local-dev override that points every shop at a mock Admin API
 * (scripts/mock-shopify.ts) so the import/sync/billing loop can be exercised without a dev store.
 */
export const shopOrigin = (env: { SHOPIFY_ADMIN_ORIGIN?: string }, shop: string) => env.SHOPIFY_ADMIN_ORIGIN || `https://${shop}`;

export const clientFor = (env: { SHOPIFY_API_VERSION: string; SHOPIFY_ADMIN_ORIGIN?: string }, shop: string, accessToken: string) =>
  adminClient(shop, accessToken, env.SHOPIFY_API_VERSION, shopOrigin(env, shop));
