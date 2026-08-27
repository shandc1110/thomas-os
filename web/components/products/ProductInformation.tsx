import Link from "next/link";
import { brandSlugFromProductBrand } from "@/lib/brands";
import type { Product } from "@/lib/types";

type ProductInformationProps = {
  product: Product;
};

export function ProductInformation({ product }: ProductInformationProps) {
  const brandSlug = brandSlugFromProductBrand(product.brand);
  const dims = formatDimensions(product);

  return (
    <header className="space-y-4">
      {product.brand ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage">
          {brandSlug ? (
            <Link href={`/brands/${brandSlug}`} className="hover:text-charcoal">
              {product.brand}
            </Link>
          ) : (
            product.brand
          )}
        </p>
      ) : null}

      <h1 className="font-serif text-2xl leading-snug text-charcoal sm:text-3xl">
        {product.name}
      </h1>

      {product.sku ? (
        <p className="text-xs uppercase tracking-[0.14em] text-muted">SKU {product.sku}</p>
      ) : null}

      {product.category ? (
        <p className="text-sm text-muted">{product.category}</p>
      ) : null}

      {product.description ? (
        <p className="text-sm leading-relaxed text-muted">{product.description}</p>
      ) : null}

      {dims ? (
        <p className="text-xs text-muted">{dims}</p>
      ) : null}
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
