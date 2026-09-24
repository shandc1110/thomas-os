/**
 * Pure Chloe's Edit feed projection helpers (testable without Supabase).
 */
import { mapProduct } from "@/lib/products/map-product";
import { isStorefrontEligible } from "./eligibility";
import { toStorefrontProduct } from "./map";
import type { StorefrontProduct } from "./types";

export type ChloeEditFeedItem = {
  product: StorefrontProduct;
  position: number;
  editorialNote: string | null;
  curationId: string;
};

export function compareChloeEditFeedItems(
  a: ChloeEditFeedItem,
  b: ChloeEditFeedItem,
): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.product.productId.localeCompare(b.product.productId);
}

/** Apply eligibility + position sort to joined curation rows. */
export function projectChloeEditFeedFromRows(
  rows: Array<{
    id: string;
    position: number;
    editorial_note: string | null;
    product: Record<string, unknown>;
  }>,
  organizationId: string,
  limit?: number,
): ChloeEditFeedItem[] {
  const items: ChloeEditFeedItem[] = [];
  for (const row of rows) {
    if (String(row.product.organization_id) !== organizationId) continue;
    const product = mapProduct(row.product);
    if (!isStorefrontEligible(product)) continue;
    items.push({
      product: toStorefrontProduct(product),
      position: Number(row.position),
      editorialNote: row.editorial_note?.trim() || null,
      curationId: row.id,
    });
  }
  items.sort(compareChloeEditFeedItems);
  if (limit != null && limit > 0) return items.slice(0, limit);
  return items;
}
