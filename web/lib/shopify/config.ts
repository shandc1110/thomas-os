import "server-only";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { getShopifyShopHostname, normalizeShopifyStore } from "./auth";

export type ShopifyConfig = {
  store: string;
  apiVersion: string;
};

export function getShopifyConfig(): ShopifyConfig {
  const store = normalizeShopifyStore(process.env.SHOPIFY_STORE ?? "");
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2025-01";

  if (!store) {
    throw new Error("SHOPIFY_STORE is not configured.");
  }

  const hasClientCreds = Boolean(
    process.env.SHOPIFY_CLIENT_ID?.trim() && process.env.SHOPIFY_CLIENT_SECRET?.trim(),
  );
  const hasLegacyToken = Boolean(process.env.SHOPIFY_ADMIN_TOKEN?.trim());
  if (!hasClientCreds && !hasLegacyToken) {
    throw new Error(
      "Shopify auth is not configured. Set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET " +
        "(Dev Dashboard), or SHOPIFY_ADMIN_TOKEN.",
    );
  }

  return { store, apiVersion };
}

export function getShopifyGraphQLUrl(config?: ShopifyConfig): string {
  const { apiVersion } = config ?? getShopifyConfig();
  const hostname = getShopifyShopHostname(config?.store);
  return `https://${hostname}/admin/api/${apiVersion}/graphql.json`;
}

/** Build admin URL for a Shopify Draft Order GID. */
export function getShopifyDraftOrderAdminUrl(draftOrderGid: string): string | null {
  try {
    const { store } = getShopifyConfig();
    const numericId = draftOrderGid.split("/").pop();
    if (!numericId) return null;
    const hostname = getShopifyShopHostname(store);
    return `https://${hostname}/admin/draft_orders/${numericId}`;
  } catch {
    return null;
  }
}

/** Tag applied to every portal-synced draft order for duplicate detection. */
export function portalOrderTag(orderNumber: string): string {
  const { shopifyPortalTagPrefix } = getActiveTenant().integrations;
  return `${shopifyPortalTagPrefix}:${orderNumber}`;
}
