import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { getSellableStock } from "@/lib/presell";
import { mapProduct } from "@/lib/products/map-product";
import { isStorefrontEligible } from "@/lib/storefront/eligibility";
import type { Product } from "@/lib/types";
import { productBelongsToBrand } from "./match";
import type { BrandConfig } from "./types";

const CATALOG_PAGE_SIZE = 1000;

/**
 * Paginate assortment-active products (storefront eligibility).
 * Never uses products.active as the visibility rule.
 */
async function fetchStorefrontProductRows(brandOrFilter?: string): Promise<Record<string, unknown>[]> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("products")
      .select("*")
      .eq("assortment_status", "active")
      .eq("organization_id", tenant.organizationId)
      .order("created_at", { ascending: false })
      .range(from, from + CATALOG_PAGE_SIZE - 1);

    if (brandOrFilter) {
      query = query.or(brandOrFilter);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < CATALOG_PAGE_SIZE) break;
    from += CATALOG_PAGE_SIZE;
  }

  return rows;
}

function brandOrFilter(brand: BrandConfig): string {
  return brand.matchNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => `brand.ilike.%${name}%`)
    .join(",");
}

function mapCatalogRows(rows: Record<string, unknown>[]): Product[] {
  return rows
    .map(mapProduct)
    .filter(isStorefrontEligible)
    .sort((a, b) => {
      const aOut = getSellableStock(a) <= 0 ? 1 : 0;
      const bOut = getSellableStock(b) <= 0 ? 1 : 0;
      return aOut - bOut;
    });
}

/** Assortment-active catalog products for the current tenant, sold-out last. */
export async function fetchCatalogProducts(): Promise<Product[]> {
  return mapCatalogRows(await fetchStorefrontProductRows());
}

export async function fetchBrandProducts(brand: BrandConfig): Promise<Product[]> {
  const orFilter = brandOrFilter(brand);
  if (!orFilter) return [];

  const rows = await fetchStorefrontProductRows(orFilter);
  return mapCatalogRows(rows).filter((p) => productBelongsToBrand(p.brand, brand));
}
