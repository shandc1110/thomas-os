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

/** Resolve a public /products/[slug] URL to an active Product. */
export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const id = extractProductIdFromSlug(slug);
  if (!id) return null;
  return fetchActiveProductById(id);
}
