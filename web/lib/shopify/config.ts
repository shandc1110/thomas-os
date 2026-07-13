import "server-only";

export type ShopifyConfig = {
  store: string;
  adminToken: string;
  apiVersion: string;
};

export function getShopifyConfig(): ShopifyConfig {
  const store = process.env.SHOPIFY_STORE?.trim();
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN?.trim();
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2025-01";

  if (!store) {
    throw new Error("SHOPIFY_STORE is not configured.");
  }
  if (!adminToken) {
    throw new Error("SHOPIFY_ADMIN_TOKEN is not configured.");
  }

  return { store, adminToken, apiVersion };
}

export function getShopifyGraphQLUrl(config?: ShopifyConfig): string {
  const { store, apiVersion } = config ?? getShopifyConfig();
  const hostname = store.includes(".myshopify.com") ? store : `${store}.myshopify.com`;
  return `https://${hostname}/admin/api/${apiVersion}/graphql.json`;
}

/** Build admin URL for a Shopify Draft Order GID. */
export function getShopifyDraftOrderAdminUrl(draftOrderGid: string): string | null {
  try {
    const { store } = getShopifyConfig();
    const numericId = draftOrderGid.split("/").pop();
    if (!numericId) return null;
    const hostname = store.includes(".myshopify.com") ? store : `${store}.myshopify.com`;
    return `https://${hostname}/admin/draft_orders/${numericId}`;
  } catch {
    return null;
  }
}

/** Tag applied to every portal-synced draft order for duplicate detection. */
export function portalOrderTag(orderNumber: string): string {
  return `portal:${orderNumber}`;
}
