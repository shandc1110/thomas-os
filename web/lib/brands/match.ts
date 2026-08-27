import { BRAND_REGISTRY, getBrandBySlug } from "./registry";
import type { BrandConfig } from "./types";

/** Normalise product.brand (or similar) for matching. */
export function normaliseBrandLabel(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve a product's free-text brand to a storefront brand slug.
 * Returns null when no registry entry matches.
 */
export function brandSlugFromProductBrand(
  productBrand: string | null | undefined,
): string | null {
  const label = normaliseBrandLabel(productBrand);
  if (!label) return null;

  for (const brand of BRAND_REGISTRY) {
    for (const match of brand.matchNames) {
      const m = normaliseBrandLabel(match);
      if (!m) continue;
      if (label === m || label.includes(m)) {
        return brand.slug;
      }
    }
  }
  return null;
}

export function productBelongsToBrand(
  productBrand: string | null | undefined,
  brand: BrandConfig,
): boolean {
  const slug = brandSlugFromProductBrand(productBrand);
  return slug === brand.slug;
}

export function resolveBrandForProductBrand(
  productBrand: string | null | undefined,
): BrandConfig | null {
  const slug = brandSlugFromProductBrand(productBrand);
  return slug ? getBrandBySlug(slug) : null;
}
