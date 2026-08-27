import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { productUrl } from "@/lib/products/slug";
import { getSellableStock } from "@/lib/presell";
import Link from "next/link";

export type ChloeEditGridProps = {
  /** Real Thomas OS catalogue products. Empty until a later merchandising sprint. */
  products?: Product[];
};

/**
 * Future merchandising grid for The Chloe Edit.
 * Desktop 4 · tablet/mobile 2. Channel-neutral; accepts catalogue products later.
 * Renders nothing when empty — no placeholder cards or empty-state copy.
 */
export function ChloeEditGrid({ products = [] }: ChloeEditGridProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
      {products.map((product) => (
        <ChloeEditProductCard key={String(product.id)} product={product} />
      ))}
    </div>
  );
}

function ChloeEditProductCard({ product }: { product: Product }) {
  const href = productUrl(product);
  const sellable = getSellableStock(product);

  return (
    <Link href={href} className="group flex flex-col">
      <div className="aspect-[4/5] overflow-hidden bg-white">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-sand/30" aria-hidden />
        )}
      </div>
      <div className="mt-4 space-y-1">
        {product.brand ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
            {product.brand}
          </p>
        ) : null}
        <p className="font-serif text-base leading-snug text-charcoal">{product.name}</p>
        <p className="text-sm text-charcoal">
          {formatPrice(product.price, product.currency)}
        </p>
        {sellable <= 0 ? (
          <p className="text-xs text-muted">Sold out</p>
        ) : null}
      </div>
    </Link>
  );
}
