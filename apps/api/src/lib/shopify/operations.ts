import { BRAND, PLAN, label, type Product } from "@lumen/core";
import { assertNoUserErrors, type AdminClient } from "./graphql";

type UserError = { field?: string[] | null; message: string; code?: string };

const money = (cents: number) => (cents / 100).toFixed(2);
export const toCents = (amount: string | number) => Math.round(Number(amount) * 100);

// ── Shop / location ──────────────────────────────────────────────────────────

export async function getShopInfo(client: AdminClient) {
  const data = await client.request<{
    shop: { currencyCode: string; name: string };
    locations: { nodes: { id: string; name: string; isActive: boolean; fulfillsOnlineOrders: boolean }[] };
  }>(`#graphql
    query ShopInfo {
      shop { name currencyCode }
      locations(first: 25) { nodes { id name isActive fulfillsOnlineOrders } }
    }`);
  const loc = data.locations.nodes.find((l) => l.isActive && l.fulfillsOnlineOrders) ?? data.locations.nodes.find((l) => l.isActive) ?? null;
  return { currency: data.shop.currencyCode, location: loc };
}

// ── Billing ──────────────────────────────────────────────────────────────────

export interface ActiveSubscription {
  id: string;
  name: string;
  status: string;
  test: boolean;
  currentPeriodEnd: string | null;
  trialDays: number;
}

export async function getActiveSubscription(client: AdminClient): Promise<ActiveSubscription | null> {
  const data = await client.request<{ currentAppInstallation: { activeSubscriptions: ActiveSubscription[] } }>(`#graphql
    query ActiveSubscriptions {
      currentAppInstallation { activeSubscriptions { id name status test currentPeriodEnd trialDays } }
    }`);
  return data.currentAppInstallation.activeSubscriptions[0] ?? null;
}

export async function createSubscription(client: AdminClient, opts: { returnUrl: string; test: boolean }) {
  const data = await client.request<{
    appSubscriptionCreate: { confirmationUrl: string | null; appSubscription: { id: string; status: string } | null; userErrors: UserError[] };
  }>(
    `#graphql
    mutation CreateSubscription($name: String!, $returnUrl: URL!, $test: Boolean, $trialDays: Int, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(name: $name, returnUrl: $returnUrl, test: $test, trialDays: $trialDays, lineItems: $lineItems) {
        confirmationUrl
        appSubscription { id status }
        userErrors { field message }
      }
    }`,
    {
      name: PLAN.name,
      returnUrl: opts.returnUrl,
      test: opts.test,
      trialDays: PLAN.trialDays,
      lineItems: [{ plan: { appRecurringPricingDetails: { price: { amount: PLAN.priceCents / 100, currencyCode: PLAN.currency }, interval: PLAN.interval } } }],
    },
  );
  assertNoUserErrors(data.appSubscriptionCreate.userErrors, "appSubscriptionCreate");
  return data.appSubscriptionCreate;
}

export async function cancelSubscription(client: AdminClient, id: string) {
  const data = await client.request<{ appSubscriptionCancel: { appSubscription: { id: string; status: string } | null; userErrors: UserError[] } }>(
    `#graphql
    mutation CancelSubscription($id: ID!) {
      appSubscriptionCancel(id: $id) { appSubscription { id status } userErrors { field message } }
    }`,
    { id },
  );
  assertNoUserErrors(data.appSubscriptionCancel.userErrors, "appSubscriptionCancel");
  return data.appSubscriptionCancel.appSubscription;
}

// ── Import ───────────────────────────────────────────────────────────────────

export interface ImportedProductResult {
  productId: string;
  variants: { id: string; sku: string; price: string; inventoryItemId: string }[];
}

/**
 * Creates the product with all variants, images, price, cost and stock in a single productSet call.
 * This is the ONLY place the platform writes price/title/description/images.
 */
export async function importProduct(
  client: AdminClient,
  product: Product,
  opts: { locationId: string; imageUrl: (key: string) => string; status: "ACTIVE" | "DRAFT" },
): Promise<ImportedProductResult> {
  const frameColors = unique(product.variants.map((v) => v.frameColor));
  const lensColors = unique(product.variants.map((v) => v.lensColor));
  const sizes = unique(product.variants.map((v) => v.size));

  const productOptions = [
    { name: "Frame", position: 1, values: frameColors.map((name) => ({ name })) },
    { name: "Lens", position: 2, values: lensColors.map((name) => ({ name })) },
    ...(sizes.length > 1 ? [{ name: "Size", position: 3, values: sizes.map((name) => ({ name })) }] : []),
  ];

  const files = product.images.map((img) => ({ originalSource: opts.imageUrl(img.url), alt: img.alt, contentType: "IMAGE" }));
  const imageForVariant = new Map(product.images.filter((i) => i.variantId).map((i) => [i.variantId!, i]));

  const variants = product.variants.map((v) => {
    const img = imageForVariant.get(v.id) ?? (v.imageUrl ? { url: v.imageUrl, alt: product.name } : null);
    return {
      optionValues: [
        { optionName: "Frame", name: v.frameColor },
        { optionName: "Lens", name: v.lensColor },
        ...(sizes.length > 1 ? [{ optionName: "Size", name: v.size }] : []),
      ],
      price: money(v.suggestedPrice),
      inventoryPolicy: "DENY",
      inventoryItem: { sku: v.sku, cost: money(v.wholesaleCost), tracked: true },
      inventoryQuantities: [{ locationId: opts.locationId, name: "available", quantity: v.stock }],
      ...(img ? { file: { originalSource: opts.imageUrl(img.url), alt: img.alt, contentType: "IMAGE" } } : {}),
    };
  });

  const input = {
    title: product.name,
    descriptionHtml: `<p>${escapeHtml(product.description)}</p>`,
    vendor: BRAND.vendor,
    productType: "Sunglasses",
    status: opts.status,
    tags: [BRAND.tag, label(product.collection), label(product.style), label(product.gender), label(product.frameMaterial), ...product.lensTypes.map(label)],
    productOptions,
    variants,
    files,
    metafields: [{ namespace: BRAND.metafieldNamespace, key: "product_id", type: "single_line_text_field", value: product.id }],
  };

  const data = await client.request<{
    productSet: {
      product: { id: string; variants: { nodes: { id: string; sku: string | null; price: string; inventoryItem: { id: string; sku: string | null } }[] } } | null;
      userErrors: UserError[];
    };
  }>(
    `#graphql
    mutation ImportProduct($input: ProductSetInput!) {
      productSet(synchronous: true, input: $input) {
        product {
          id
          variants(first: 100) { nodes { id sku price inventoryItem { id sku } } }
        }
        userErrors { field message code }
      }
    }`,
    { input },
  );
  assertNoUserErrors(data.productSet.userErrors, `productSet(${product.slug})`);
  const p = data.productSet.product!;
  return {
    productId: p.id,
    variants: p.variants.nodes.map((n) => ({ id: n.id, sku: n.sku ?? n.inventoryItem.sku ?? "", price: n.price, inventoryItemId: n.inventoryItem.id })),
  };
}

// ── Sync (cost + stock only) ─────────────────────────────────────────────────

/** Updates "Cost per item" for variants of one product. Price is deliberately never included. */
export async function updateCosts(client: AdminClient, shopifyProductId: string, items: { variantId: string; costCents: number }[]) {
  if (!items.length) return;
  const data = await client.request<{ productVariantsBulkUpdate: { userErrors: UserError[] } }>(
    `#graphql
    mutation UpdateCosts($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
    }`,
    { productId: shopifyProductId, variants: items.map((i) => ({ id: i.variantId, inventoryItem: { cost: money(i.costCents) } })) },
  );
  assertNoUserErrors(data.productVariantsBulkUpdate.userErrors, "productVariantsBulkUpdate(cost)");
}

/**
 * Sets absolute "available" quantity at our location.
 * changeFromQuantity: null opts out of compare-and-swap on purpose: the wholesaler's warehouse is the source of truth.
 * @idempotent is mandatory for inventory mutations from API 2026-04.
 */
export async function setStock(client: AdminClient, locationId: string, items: { inventoryItemId: string; quantity: number }[], idempotencyKey: string) {
  if (!items.length) return;
  const data = await client.request<{ inventorySetQuantities: { userErrors: UserError[] } }>(
    `#graphql
    mutation SetStock($input: InventorySetQuantitiesInput!, $key: String!) {
      inventorySetQuantities(input: $input) @idempotent(key: $key) { userErrors { field message code } }
    }`,
    {
      key: idempotencyKey,
      input: {
        name: "available",
        reason: "correction",
        referenceDocumentUri: `lumen://sync/${idempotencyKey}`,
        quantities: items.map((i) => ({ inventoryItemId: i.inventoryItemId, locationId, quantity: i.quantity, changeFromQuantity: null })),
      },
    },
  );
  assertNoUserErrors(data.inventorySetQuantities.userErrors, "inventorySetQuantities");
}

/** Reads the subscriber's current selling prices (for margin alerts). Returns null if the product was deleted. */
export async function getVariantPrices(client: AdminClient, shopifyProductId: string) {
  const data = await client.request<{ product: { status: string; variants: { nodes: { id: string; price: string }[] } } | null }>(
    `#graphql
    query VariantPrices($id: ID!) {
      product(id: $id) { status variants(first: 100) { nodes { id price } } }
    }`,
    { id: shopifyProductId },
  );
  if (!data.product) return null;
  return { status: data.product.status, prices: new Map(data.product.variants.nodes.map((n) => [n.id, toCents(n.price)])) };
}

export async function setProductStatus(client: AdminClient, shopifyProductId: string, status: "ACTIVE" | "DRAFT") {
  const data = await client.request<{ productUpdate: { product: { id: string } | null; userErrors: UserError[] } }>(
    `#graphql
    mutation SetStatus($product: ProductUpdateInput!) {
      productUpdate(product: $product) { product { id } userErrors { field message } }
    }`,
    { product: { id: shopifyProductId, status } },
  );
  if (!data.productUpdate.product && data.productUpdate.userErrors.some((e) => /not exist|not found/i.test(e.message))) return "missing" as const;
  assertNoUserErrors(data.productUpdate.userErrors, "productUpdate(status)");
  return "ok" as const;
}

const unique = <T>(xs: T[]) => [...new Set(xs)];
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
