import { jwtVerify } from "jose";

export interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub?: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid?: string;
}

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
export const isValidShopDomain = (s: string) => SHOP_RE.test(s);

/**
 * Verifies an App Bridge session token (HS256, signed with the app secret).
 * https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 */
export async function verifySessionToken(token: string, apiKey: string, apiSecret: string) {
  const { payload } = await jwtVerify<SessionTokenPayload>(token, new TextEncoder().encode(apiSecret), {
    algorithms: ["HS256"],
    audience: apiKey,
    clockTolerance: 10,
  });
  const shop = new URL(payload.dest).hostname;
  if (!isValidShopDomain(shop) || new URL(payload.iss).hostname !== shop) throw new Error("Session token shop mismatch");
  return { shop, payload };
}

/**
 * Token exchange: swaps the session token for an offline Admin API access token.
 * Used with Shopify managed installation, so there is no OAuth redirect dance.
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
 */
export async function exchangeForOfflineToken(shop: string, sessionToken: string, apiKey: string, apiSecret: string, origin = `https://${shop}`) {
  const res = await fetch(`${origin}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: sessionToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { access_token: string; scope: string };
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));

/** Constant-time comparison. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Webhook HMAC: base64(HMAC-SHA256(secret, rawBody)) in X-Shopify-Hmac-Sha256. */
export async function verifyWebhookHmac(rawBody: ArrayBuffer, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, rawBody);
  return safeEqual(b64(sig), hmacHeader);
}
