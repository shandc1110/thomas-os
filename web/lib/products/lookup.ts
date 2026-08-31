import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import type { Product } from "@/lib/types";
import { mapProduct } from "./map-product";
import { extractProductIdFromSlug } from "./slug";

/** Active tenant product by internal id (storefront visibility rules). */
export async function fetchActiveProductById(id: string): Promise<Product | null> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .eq("organization_id", tenant.organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProduct(data as Record<string, unknown>);
}

/** Resolve a public /products/[slug] URL to an active listing Product. */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const id = extractProductIdFromSlug(slug);
  if (!id) return null;
  return fetchActiveProductById(id);
}

/** Listing product plus sellable variant SKU rows for PDP size/colour selection. */
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

  let variantQuery = supabase
    .from("products")
    .select("*")
    .contains("tags", [`cbc_vgroup:${product.variant_group_key}`, "cbc_variant"])
    .eq("active", true)
    .eq("organization_id", tenant.organizationId);

  // Prefer DB column when migration 0015 is applied
  if (product.variant_group_key) {
    const { data: byColumn, error: columnError } = await supabase
      .from("products")
      .select("*")
      .eq("variant_group_key", product.variant_group_key)
      .eq("is_listing_product", false)
      .eq("active", true)
      .eq("organization_id", tenant.organizationId)
      .order("sku");

    if (!columnError && byColumn && byColumn.length > 0) {
      const variants = (byColumn as Record<string, unknown>[]).map(mapProduct);
      return { product, variants };
    }
  }

  const { data, error } = await variantQuery;

  if (error) return { product, variants: [product] };

  const variants = ((data ?? []) as Record<string, unknown>[]).map(mapProduct);
  if (variants.length === 0) return { product, variants: [product] };
  return { product, variants };
}
