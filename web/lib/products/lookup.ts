/**
 * Fetch an assortment-active listing product by id (storefront visibility).
 * Eligibility is assortment_status = 'active' — never products.active alone.
 */
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import type { Product } from "@/lib/types";
import { isStorefrontEligible } from "@/lib/storefront/eligibility";
import { mapProduct } from "./map-product";
import { extractProductIdFromSlug } from "./slug";

export async function fetchActiveProductById(id: string): Promise<Product | null> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("assortment_status", "active")
    .eq("organization_id", tenant.organizationId)
    .maybeSingle();

  if (error || !data) return null;

  const product = mapProduct(data as Record<string, unknown>);
  if (!isStorefrontEligible(product)) return null;
  return product;
}

/** Resolve a public /products/[slug] URL to a storefront-eligible listing Product. */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const id = extractProductIdFromSlug(slug);
  if (!id) return null;
  return fetchActiveProductById(id);
}

/**
 * Listing product plus sellable variant SKU rows for PDP size/colour selection.
 * Listing must be assortment-active; variant children are purchase options (not shop cards).
 */
export async function fetchProductWithVariants(slug: string): Promise<{
  product: Product;
  variants: Product[];
} | null> {
  const product = await fetchProductBySlug(slug);
  if (!product) return null;

  if (!product.variant_group_key || (product.variant_count ?? 1) <= 1) {
    return { product, variants: [product] };
  }

  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();

  if (product.variant_group_key) {
    const { data: byColumn, error: columnError } = await supabase
      .from("products")
      .select("*")
      .eq("variant_group_key", product.variant_group_key)
      .eq("is_listing_product", false)
      .eq("organization_id", tenant.organizationId)
      .order("sku");

    if (!columnError && byColumn && byColumn.length > 0) {
      const variants = (byColumn as Record<string, unknown>[]).map(mapProduct);
      return { product, variants };
    }
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .contains("tags", [`cbc_vgroup:${product.variant_group_key}`, "cbc_variant"])
    .eq("organization_id", tenant.organizationId);

  if (error) return { product, variants: [product] };

  const variants = ((data ?? []) as Record<string, unknown>[]).map(mapProduct);
  if (variants.length === 0) return { product, variants: [product] };
  return { product, variants };
}
