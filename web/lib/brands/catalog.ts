import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { getSellableStock } from "@/lib/presell";
import { mapProduct } from "@/lib/products/map-product";
import type { Product } from "@/lib/types";
import { productBelongsToBrand } from "./match";
import type { BrandConfig } from "./types";

/** Active catalog products for the current tenant, sold-out last. */
export async function fetchCatalogProducts(): Promise<Product[]> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("organization_id", tenant.organizationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[])
    .map(mapProduct)
    .sort((a, b) => {
      const aOut = getSellableStock(a) <= 0 ? 1 : 0;
      const bOut = getSellableStock(b) <= 0 ? 1 : 0;
      return aOut - bOut;
    });
}

export async function fetchBrandProducts(brand: BrandConfig): Promise<Product[]> {
  const all = await fetchCatalogProducts();
  return all.filter((p) => productBelongsToBrand(p.brand, brand));
}
