import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { and, isNull, lt, ne } from "drizzle-orm";
import type { AppContext, Env } from "./env";
import type { JobMessage } from "./jobs/messages";
import { handleJob } from "./jobs/handlers";
import { app as embeddedApp } from "./routes/app";
import { admin } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import { webhooks } from "./routes/webhooks";
import { getDb } from "./db/repo";
import * as s from "./db/schema";
import { reconcileSubscription } from "./lib/subscription";
import { ShopifyError } from "./lib/shopify/graphql";

const api = new Hono<AppContext>();

api.use("/api/public/*", async (c, next) => cors({ origin: "*", allowMethods: ["GET"] })(c, next));
api.use("/api/admin/*", async (c, next) =>
  cors({ origin: c.env.CORS_ORIGINS.split(","), allowHeaders: ["Authorization", "Content-Type"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"] })(c, next),
);

api.get("/health", (c) => c.json({ ok: true }));
api.route("/api/public", publicRoutes);
api.route("/api/admin", admin);
api.route("/api/app", embeddedApp);
api.route("/webhooks", webhooks);

/** Product images from R2 (immutable keys → long cache). */
api.get("/img/*", async (c) => {
  const key = decodeURIComponent(c.req.path.slice("/img/".length));
  const obj = await c.env.IMAGES.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  return new Response(obj.body, { headers });
});

api.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ error: "Invalid input", issues: err.issues }, 400);
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof ShopifyError) {
    console.error("shopify", err.message, err.details);
    return c.json({ error: err.message }, 502);
  }
  console.error(err);
  return c.json({ error: "Internal error" }, 500);
});

export default {
  fetch: api.fetch,

  async queue(batch: MessageBatch<JobMessage>, env: Env) {
    // Sequential within a batch: keeps a single store's GraphQL cost bucket healthy.
    for (const msg of batch.messages) {
      const result = await handleJob(env, msg.body, msg.attempts);
      if (result === "ack") msg.ack();
      else msg.retry({ delaySeconds: Math.min(60 * msg.attempts, 600) });
    }
  },

  /** Safety net every 6h: re-check billing for connected stores (missed webhooks) and prune old webhook ids. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const db = getDb(env);
    const shops = await db
      .select()
      .from(s.shops)
      .where(and(isNull(s.shops.uninstalledAt), ne(s.shops.subscriptionStatus, "NONE")));
    for (const shop of shops) ctx.waitUntil(reconcileSubscription(env, shop, { force: true }).catch((e) => console.error("reconcile", shop.domain, e)));
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    ctx.waitUntil(db.delete(s.webhookEvents).where(lt(s.webhookEvents.receivedAt, weekAgo)).then(() => undefined));
  },
} satisfies ExportedHandler<Env, JobMessage>;

