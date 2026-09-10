import { StorefrontProductCard } from "@/components/shop/StorefrontProductCard";
import type { StorefrontProduct } from "@/lib/storefront";

export type ChloeEditGridProps = {
  /**
   * Curated StorefrontProduct list for The Chloe Edit.
   * Sourced from chloe_edit_products + storefront eligibility.
   */
  products?: StorefrontProduct[];
};

/**
 * Merchandising grid for The Chloe Edit.
 * Desktop 4 · tablet/mobile 2. Consumes StorefrontProduct[].
 * Renders nothing when empty — no placeholder cards or empty-state copy.
 */
export function ChloeEditGrid({ products = [] }: ChloeEditGridProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
      {products.map((product) => (
        <StorefrontProductCard key={product.productId} product={product} />
      ))}
    </div>
  );
}
