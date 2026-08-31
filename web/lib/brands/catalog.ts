import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { getSellableStock } from "@/lib/presell";
import { mapProduct } from "@/lib/products/map-product";
import type { Product } from "@/lib/types";
import { productBelongsToBrand } from "./match";
import type { BrandConfig } from "./types";

const CATALOG_PAGE_SIZE = 1000;

/** Paginate past Supabase/PostgREST default 1000-row cap. */
async function fetchActiveProductRows(brandOrFilter?: string): Promise<Record<string, unknown>[]> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("products")
      .select("*")
      .eq("active", true)
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
    .filter((p) => p.is_listing_product !== false)
    .sort((a, b) => {
      const aOut = getSellableStock(a) <= 0 ? 1 : 0;
      const bOut = getSellableStock(b) <= 0 ? 1 : 0;
      return aOut - bOut;
    });
}

/** Active catalog products for the current tenant, sold-out last. */
export async function fetchCatalogProducts(): Promise<Product[]> {
  return mapCatalogRows(await fetchActiveProductRows());
}

export async function fetchBrandProducts(brand: BrandConfig): Promise<Product[]> {
  const orFilter = brandOrFilter(brand);
  if (!orFilter) return [];

  const rows = await fetchActiveProductRows(orFilter);
  return mapCatalogRows(rows).filter((p) => productBelongsToBrand(p.brand, brand));
}
