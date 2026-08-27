import "server-only";

type CachedToken = {
  accessToken: string;
  /** Epoch ms when we should refresh (before Shopify expiry). */
  refreshAt: number;
};

let cached: CachedToken | null = null;

export function normalizeShopifyStore(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.myshopify\.com$/i, "")
    .trim();
}

export function getShopifyShopHostname(store?: string): string {
  const handle = store ?? normalizeShopifyStore(process.env.SHOPIFY_STORE ?? "");
  if (!handle) throw new Error("SHOPIFY_STORE is not configured.");
  return handle.includes(".myshopify.com") ? handle : `${handle}.myshopify.com`;
}

/**
 * Resolve an Admin API access token.
 *
 * Prefer Dev Dashboard client credentials (2026+): exchanges Client ID + Secret
 * for a short-lived token (≈24h), cached in memory.
 *
 * Legacy fallback: SHOPIFY_ADMIN_TOKEN (static shpat_…).
 */
export async function getShopifyAccessToken(): Promise<string> {
  const clientId = process.env.SHOPIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET?.trim();
  const legacyToken = process.env.SHOPIFY_ADMIN_TOKEN?.trim();

  if (clientId && clientSecret) {
    const now = Date.now();
    if (cached && now < cached.refreshAt) {
      return cached.accessToken;
    }

    const shop = getShopifyShopHostname();
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const body = await response.text();
    if (!response.ok) {
      const title = body.match(/<title>([^<]+)<\/title>/i)?.[1] ?? body.slice(0, 200);
      console.error("Shopify client_credentials failed:", response.status, title);
      throw new Error(
        `Could not get Shopify access token (HTTP ${response.status}: ${title}). ` +
          "Check SHOPIFY_STORE is the myshopify handle (e.g. by-chloe-8018), " +
          "CLIENT_ID/SECRET are correct, and ThomasCore is installed on that store.",
      );
    }

    let json: { access_token?: string; expires_in?: number };
    try {
      json = JSON.parse(body) as { access_token?: string; expires_in?: number };
    } catch {
      throw new Error("Shopify token endpoint returned invalid JSON.");
    }

    if (!json.access_token) {
      throw new Error("Shopify token endpoint did not return access_token.");
    }

    const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 86399;
    // Refresh 5 minutes before expiry
    cached = {
      accessToken: json.access_token,
      refreshAt: now + Math.max(60, expiresInSec - 300) * 1000,
    };
    return cached.accessToken;
  }

  if (legacyToken) {
    return legacyToken;
  }

  throw new Error(
    "Shopify is not configured. Set SHOPIFY_STORE plus SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET " +
      "(Dev Dashboard), or a legacy SHOPIFY_ADMIN_TOKEN.",
  );
}
