import type { ShopifyGraphQLResponse } from "@/types/shopify";
import { getShopifyConfig, getShopifyGraphQLUrl } from "./config";

export async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const config = getShopifyConfig();
  const url = getShopifyGraphQLUrl(config);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.adminToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Shopify GraphQL HTTP error:", response.status, body);
    throw new Error(`Shopify API returned HTTP ${response.status}.`);
  }

  const json = (await response.json()) as ShopifyGraphQLResponse<T>;

  if (json.errors?.length) {
    const message = json.errors.map((e) => e.message).join("; ");
    console.error("Shopify GraphQL errors:", message);
    throw new Error(message);
  }

  if (!json.data) {
    throw new Error("Shopify API returned no data.");
  }

  return json.data;
}
