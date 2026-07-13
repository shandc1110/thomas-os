import type { ShopifyDraftOrderNode } from "@/types/shopify";
import { portalOrderTag } from "./config";
import { shopifyGraphQL } from "./graphql";

const SEARCH_DRAFT_ORDERS = `
  query SearchDraftOrders($query: String!) {
    draftOrders(first: 5, query: $query) {
      edges {
        node {
          id
          name
          tags
          note
        }
      }
    }
  }
`;

/**
 * Search Shopify for an existing draft order linked to a portal order number.
 * Uses the portal tag (e.g. portal:CBC9001) for reliable duplicate detection.
 */
export async function searchDraftOrderByPortalNumber(
  orderNumber: string,
): Promise<ShopifyDraftOrderNode | null> {
  const tag = portalOrderTag(orderNumber);
  const query = `tag:${tag}`;

  console.info(`[shopify] Searching draft orders with query: ${query}`);

  const data = await shopifyGraphQL<{
    draftOrders: { edges: { node: ShopifyDraftOrderNode }[] };
  }>(SEARCH_DRAFT_ORDERS, { query });

  const match = data.draftOrders.edges[0]?.node ?? null;

  if (match) {
    console.info(`[shopify] Found existing draft order ${match.id} for ${orderNumber}`);
  } else {
    console.info(`[shopify] No existing draft order for ${orderNumber}`);
  }

  return match;
}
