import Link from "next/link";
import { brandSlugFromProductBrand } from "@/lib/brands";
import type { Product } from "@/lib/types";

type ProductInformationProps = {
  product: Product;
};

/**
 * PDP product identity + content.
 * Does not invent missing description or category copy.
 */
export function ProductInformation({ product }: ProductInformationProps) {
  const brandSlug = brandSlugFromProductBrand(product.brand);
  const dims = formatDimensions(product);
  const description = product.description?.trim() || null;
  const category = product.category?.trim() || null;

  return (
    <header className="space-y-5">
      {product.brand ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage">
          {brandSlug ? (
            <Link href={`/brands/${brandSlug}`} className="hover:text-charcoal">
              {product.brand}
            </Link>
          ) : (
            product.brand
          )}
        </p>
      ) : null}

      <h1 className="font-serif text-2xl leading-snug text-charcoal sm:text-3xl md:text-[2.1rem]">
        {product.name}
      </h1>

      {category ? <p className="text-sm text-muted">{category}</p> : null}

      {description ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted sm:text-[0.95rem]">
          {description}
        </p>
      ) : null}

      {product.sku ? (
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted/80">SKU {product.sku}</p>
      ) : null}

      {dims ? <p className="text-xs text-muted">{dims}</p> : null}
    </header>
  );
}

function formatDimensions(product: Product): string | null {
  const parts: string[] = [];
  if (product.weight_grams != null) {
    parts.push(`${product.weight_grams} g`);
  }
  const l = product.length_mm;
  const w = product.width_mm;
  const h = product.height_mm;
  if (l != null && w != null && h != null) {
    parts.push(`${l} × ${w} × ${h} mm`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
