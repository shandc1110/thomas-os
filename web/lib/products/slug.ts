import { brandSlugFromProductBrand } from "@/lib/brands";
import type { Product } from "@/lib/types";

const UUID_TAIL =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const NUMERIC_TAIL = /-(\d+)$/;

const MAX_SEGMENT_LENGTH = 48;

/** URL-safe segment from human-readable text. */
export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SEGMENT_LENGTH);
}

/**
 * Stable public slug: brand + name + internal id.
 * Human-readable prefix; stable id suffix prevents collisions and URL drift
 * when price/stock/images change. No DB column required in Sprint 04B.
 */
export function buildProductSlug(product: Pick<Product, "id" | "name" | "brand">): string {
  const id = String(product.id);
  const brandSlug =
    brandSlugFromProductBrand(product.brand) ??
    (slugifySegment(product.brand ?? "") || "product");
  const nameSlug = slugifySegment(product.name);

  const segments = [brandSlug];
  if (nameSlug) segments.push(nameSlug);
  segments.push(id);

  return segments.join("-");
}

/** Canonical storefront path for a product. */
export function productUrl(product: Pick<Product, "id" | "name" | "brand">): string {
  return `/products/${buildProductSlug(product)}`;
}

/**
 * Extract stable product id embedded in a public slug.
 * Supports UUID (primary) and legacy numeric ids.
 */
export function extractProductIdFromSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const uuidMatch = UUID_TAIL.exec(trimmed);
  if (uuidMatch) return uuidMatch[1];

  const numericMatch = NUMERIC_TAIL.exec(trimmed);
  if (numericMatch) return numericMatch[1];

  return null;
}
