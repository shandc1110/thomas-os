import Link from "next/link";
import { PRODUCT_IMAGE_CONTAIN_CLASS } from "@/components/products/ProductImage";
import { formatPrice } from "@/lib/format";
import type { StorefrontAvailabilityStatus, StorefrontProduct } from "@/lib/storefront";

export type StorefrontProductCardProps = {
  product: StorefrontProduct;
};

function availabilityLine(
  status: StorefrontAvailabilityStatus,
  message: string | null,
): string | null {
  switch (status) {
    case "sold_out":
      return "Out of stock";
    case "preorder":
      return message ?? "Pre-order";
    case "in_stock":
      return "In stock";
    case "unavailable":
      return "Unavailable";
    default:
      return null;
  }
}

/**
 * Reusable merchandising card for Shop, Chloe's Edit, collections, search.
 * Hierarchy: image → brand → name → price → availability.
 * Price is Shopify-channel GBP when configured — never silent CNY fallback.
 */
export function StorefrontProductCard({ product }: StorefrontProductCardProps) {
  const soldOut = product.availabilityStatus === "sold_out";
  const availability = availabilityLine(
    product.availabilityStatus,
    product.availabilityMessage,
  );
  const priceConfigured =
    product.priceStatus === "configured" &&
    product.price != null &&
    product.currency;

  return (
    <Link href={product.url} className="group flex h-full flex-col">
      {/* Transparent frame — sits on #F3EBDD canvas; no card outline/shadow/fill. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-transparent">
        {product.primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.primaryImage}
            alt={product.productName}
            className={`${PRODUCT_IMAGE_CONTAIN_CLASS} ${soldOut ? "opacity-55" : ""}`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs uppercase tracking-widest text-muted">No image</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1.5">
        {product.brand ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sage">
            {product.brand}
          </p>
        ) : null}
        <h3 className="font-serif text-[0.95rem] leading-snug text-charcoal sm:text-base">
          {product.productName}
        </h3>
        {priceConfigured ? (
          <p className="text-sm text-charcoal">
            {formatPrice(product.price!, product.currency!)}
          </p>
        ) : (
          <p className="text-sm text-muted">Price unavailable</p>
        )}
        {availability ? (
          <p className="mt-auto pt-1 text-xs text-muted">{availability}</p>
        ) : null}
      </div>
    </Link>
  );
}

/** Alias for callers that expect ProductCard naming in storefront contexts. */
export { StorefrontProductCard as ProductCard };
