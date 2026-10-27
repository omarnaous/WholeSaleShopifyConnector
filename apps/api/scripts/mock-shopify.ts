/**
 * A tiny in-memory stand-in for the Shopify Admin API (token exchange + the GraphQL operations we use).
 * Lets the full install → bill → import → sync → cancel → resubscribe loop run locally.
 *   tsx scripts/mock-shopify.ts      (listens on :9911)
 */
import { createServer } from "node:http";

type Variant = { id: string; sku: string; price: string; cost: string; inventoryItemId: string; available: number };
type Product = { id: string; title: string; status: string; variants: Variant[]; files: number };

const state = {
  subscription: null as null | { id: string; status: string; test: boolean },
  products: new Map<string, Product>(),
  log: [] as { op: string; variables: unknown }[],
};
let seq = 1000;
const gid = (type: string) => `gid://shopify/${type}/${++seq}`;

function handle(op: string, v: any): unknown {
  switch (op) {
    case "ShopInfo":
      return { shop: { name: "Mock Store", currencyCode: "USD" }, locations: { nodes: [{ id: "gid://shopify/Location/1", name: "Main warehouse", isActive: true, fulfillsOnlineOrders: true }] } };
    case "ActiveSubscriptions":
      return {
        currentAppInstallation: {
          activeSubscriptions:
            state.subscription?.status === "ACTIVE" ? [{ ...state.subscription, name: "Plan", currentPeriodEnd: new Date(Date.now() + 30 * 864e5).toISOString(), trialDays: 7 }] : [],
        },
      };
    case "CreateSubscription": {
      state.subscription = { id: gid("AppSubscription"), status: "PENDING", test: v.test };
      return { appSubscriptionCreate: { confirmationUrl: `https://mock.shopify/confirm/${state.subscription.id}`, appSubscription: { id: state.subscription.id, status: "PENDING" }, userErrors: [] } };
    }
    case "CancelSubscription":
      if (state.subscription) state.subscription.status = "CANCELLED";
      return { appSubscriptionCancel: { appSubscription: state.subscription, userErrors: [] } };
    case "ImportProduct": {
      const id = gid("Product");
      const variants: Variant[] = v.input.variants.map((x: any) => ({
        id: gid("ProductVariant"),
        sku: x.inventoryItem.sku,
        price: x.price,
        cost: x.inventoryItem.cost,
        inventoryItemId: gid("InventoryItem"),
        available: x.inventoryQuantities[0].quantity,
      }));
      state.products.set(id, { id, title: v.input.title, status: v.input.status, variants, files: v.input.files.length });
      return { productSet: { product: { id, variants: { nodes: variants.map((x) => ({ id: x.id, sku: x.sku, price: x.price, inventoryItem: { id: x.inventoryItemId, sku: x.sku } })) } }, userErrors: [] } };
    }
    case "VariantPrices": {
      const p = state.products.get(v.id);
      return { product: p ? { status: p.status, variants: { nodes: p.variants.map((x) => ({ id: x.id, price: x.price })) } } : null };
    }
    case "UpdateCosts": {
      const p = state.products.get(v.productId)!;
      if (v.variants.some((x: any) => "price" in x)) throw new Error("PRICE MUST NEVER BE SYNCED");
      for (const x of v.variants) p.variants.find((y) => y.id === x.id)!.cost = x.inventoryItem.cost;
      return { productVariantsBulkUpdate: { userErrors: [] } };
    }
    case "SetStock": {
      if (!v.key) throw new Error("@idempotent key missing");
      for (const q of v.input.quantities) {
        if (!("changeFromQuantity" in q)) throw new Error("changeFromQuantity must be passed (2026-04+)");
        for (const p of state.products.values()) for (const x of p.variants) if (x.inventoryItemId === q.inventoryItemId) x.available = q.quantity;
      }
      return { inventorySetQuantities: { userErrors: [] } };
    }
    case "SetStatus": {
      const p = state.products.get(v.product.id);
      if (!p) return { productUpdate: { product: null, userErrors: [{ field: ["id"], message: "Product does not exist" }] } };
      p.status = v.product.status;
      return { productUpdate: { product: { id: p.id }, userErrors: [] } };
    }
  }
  throw new Error(`Unknown operation ${op}`);
}

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const json = (code: number, data: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };

  if (req.url === "/admin/oauth/access_token") return json(200, { access_token: "shpat_mock", scope: "write_products,write_inventory,read_locations" });
  if (req.url === "/__state") return json(200, { subscription: state.subscription, products: [...state.products.values()], log: state.log });
  if (req.url === "/__approve" && state.subscription) {
    state.subscription.status = "ACTIVE";
    return json(200, state.subscription);
  }
  if (req.url === "/__set-price") {
    for (const p of state.products.values()) for (const x of p.variants) if (x.sku === body.sku) x.price = body.price;
    return json(200, { ok: true });
  }
  if (req.url?.startsWith("/admin/api/")) {
    const op = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? "?";
    state.log.push({ op, variables: body.variables });
    try {
      return json(200, { data: handle(op, body.variables ?? {}) });
    } catch (e) {
      return json(200, { errors: [{ message: (e as Error).message }] });
    }
  }
  json(404, { error: "not found" });
});

server.listen(9911, () => console.log("mock shopify on :9911"));
