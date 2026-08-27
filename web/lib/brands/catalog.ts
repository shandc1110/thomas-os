import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import { getSellableStock } from "@/lib/presell";
import type { Product } from "@/lib/types";
import { productBelongsToBrand } from "./match";
import type { BrandConfig } from "./types";

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string | number,
    sku: (row.sku as string | null) ?? null,
    name: row.name as string,
    brand: (row.brand as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    barcode: (row.barcode as string | null) ?? null,
    price: row.price != null ? Number(row.price) : null,
    retail_price: row.retail_price != null ? Number(row.retail_price) : null,
    shopify_price: row.shopify_price != null ? Number(row.shopify_price) : null,
    cost_price: row.cost_price != null ? Number(row.cost_price) : null,
    currency: (row.currency as string | null) ?? "CNY",
    image_url: (row.image_url as string | null) ?? null,
    gallery_images: (row.gallery_images as string[]) ?? [],
    stock: (row.stock as number | null) ?? 0,
    presell_enabled: (row.presell_enabled as boolean | null) ?? false,
    presell_quantity: (row.presell_quantity as number | null) ?? 0,
    expected_arrival_month: (row.expected_arrival_month as string | null) ?? null,
    active: (row.active as boolean | null) ?? true,
    status: (row.status as string | null) ?? null,
    weight_grams: (row.weight_grams as number | null) ?? null,
    length_mm: (row.length_mm as number | null) ?? null,
    width_mm: (row.width_mm as number | null) ?? null,
    height_mm: (row.height_mm as number | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

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
