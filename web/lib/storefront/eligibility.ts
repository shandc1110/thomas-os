import type { AssortmentStatus, Product } from "@/lib/types";

/**
 * Strict storefront eligibility (Sprint 06).
 * Only assortment_status = 'active'.
 * Never uses products.active as the storefront visibility rule.
 */
export function isStorefrontAssortmentActive(
  assortmentStatus: AssortmentStatus | null | undefined,
): boolean {
  return assortmentStatus === "active";
}

/**
 * Whether a product row may appear on the customer-facing storefront.
 * Listing parents only (variant SKU rows are purchase options, not shop cards).
 */
export function isStorefrontEligible(
  product: Pick<Product, "assortment_status" | "is_listing_product">,
): boolean {
  if (!isStorefrontAssortmentActive(product.assortment_status)) return false;
  if (product.is_listing_product === false) return false;
  return true;
}
