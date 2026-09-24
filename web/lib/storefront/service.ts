import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { getSellableStock } from "@/lib/presell";
import { mapProduct } from "@/lib/products/map-product";
import { extractProductIdFromSlug } from "@/lib/products/slug";
import type { Product } from "@/lib/types";
import { isStorefrontEligible } from "./eligibility";
import { toStorefrontProduct } from "./map";
import type { StorefrontProduct } from "./types";

const PAGE_SIZE = 1000;

/** Paginate assortment-active rows for the current tenant. */
async function fetchAssortmentActiveRows(): Promise<Record<string, unknown>[]> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("assortment_status", "active")
      .eq("organization_id", tenant.organizationId)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

function toEligibleStorefrontProducts(rows: Record<string, unknown>[]): StorefrontProduct[] {
  return rows
    .map(mapProduct)
    .filter(isStorefrontEligible)
    .map((p) => toStorefrontProduct(p))
    .sort((a, b) => {
      const aOut = a.sellableStock <= 0 ? 1 : 0;
      const bOut = b.sellableStock <= 0 ? 1 : 0;
      return aOut - bOut;
    });
}

/** All storefront-eligible products for the active tenant. */
export async function getStorefrontProducts(): Promise<StorefrontProduct[]> {
  return toEligibleStorefrontProducts(await fetchAssortmentActiveRows());
}

/** Single product by id — null if missing or not storefront-eligible. */
export async function getStorefrontProduct(
  productId: string,
): Promise<StorefrontProduct | null> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("organization_id", tenant.organizationId)
    .maybeSingle();

  if (error || !data) return null;

  const product = mapProduct(data as Record<string, unknown>);
  if (!isStorefrontEligible(product)) return null;
  return toStorefrontProduct(product);
}

/** Resolve public slug → storefront product (uses embedded id). */
export async function getStorefrontProductBySlug(
  slug: string,
): Promise<StorefrontProduct | null> {
  const id = extractProductIdFromSlug(slug);
  if (!id) return null;
  return getStorefrontProduct(id);
}

/**
 * Lightweight search foundation over the eligible catalogue.
 * Filters in memory for name / brand / sku / category — not a search engine.
 */
export async function searchStorefrontProducts(query: string): Promise<StorefrontProduct[]> {
  const q = query.trim().toLowerCase();
  const all = await getStorefrontProducts();
  if (!q) return all;

  return all.filter((p) => {
    const hay = [p.productName, p.brand, p.sku, p.category, p.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Map Product → StorefrontProduct when the row is already loaded. */
export function projectStorefrontProduct(product: Product): StorefrontProduct | null {
  if (!isStorefrontEligible(product)) return null;
  return toStorefrontProduct(product);
}

/** Helper for tests — sellable stock on operational product. */
export function storefrontSellableFromProduct(product: Product): number {
  return getSellableStock(product);
}
