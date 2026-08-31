import type { Product } from "@/lib/types";
import { getSellableStock } from "@/lib/presell";

export function productHasVariants(product: Product): boolean {
  return (product.variant_count ?? 1) > 1;
}

export function variantOptionLabel(product: Product): string {
  const parts = [product.variant_option1, product.variant_option2]
    .filter((v) => v && v !== "Default Title")
    .map((v) => String(v).trim());
  return parts.join(" / ");
}

export function listingSellableStock(product: Product, variants: Product[]): number {
  if (!productHasVariants(product)) return getSellableStock(product);
  return variants.reduce((sum, v) => sum + getSellableStock(v), 0);
}

export function minVariantPrice(variants: Product[]): number | null {
  const prices = variants.map((v) => v.price).filter((p): p is number => p != null && p > 0);
  if (!prices.length) return null;
  return Math.min(...prices);
}
