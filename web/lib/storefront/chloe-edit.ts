/**
 * Chloe's Edit — customer-facing curated feed.
 * Curation rows + storefront-eligible products → StorefrontProduct projection.
 * Never infers membership from brand/price/tags/heuristics.
 */
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import {
  projectChloeEditFeedFromRows,
  type ChloeEditFeedItem,
} from "./chloe-edit-project";
import type { StorefrontProduct } from "./types";

export type { ChloeEditFeedItem } from "./chloe-edit-project";
export { projectChloeEditFeedFromRows } from "./chloe-edit-project";

export type GetChloeEditFeedOptions = {
  /** Homepage uses a small editorial slice (e.g. 6). Omit for full Edit. */
  limit?: number;
};

type CurationJoinRow = {
  id: string;
  position: number;
  editorial_note: string | null;
  product_id: string;
  products: Record<string, unknown> | Record<string, unknown>[] | null;
};

function unwrapProduct(
  raw: CurationJoinRow["products"],
): Record<string, unknown> | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as Record<string, unknown>) ?? null;
  return raw;
}

/**
 * Customer-facing Chloe's Edit feed.
 * Includes only storefront-eligible products (active assortment listing rows).
 * Paused/retired curated products stay in the table but are omitted here.
 */
export async function getChloeEditFeed(
  options: GetChloeEditFeedOptions = {},
): Promise<ChloeEditFeedItem[]> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("chloe_edit_products")
    .select("id, position, editorial_note, product_id, products!inner(*)")
    .eq("organization_id", tenant.organizationId)
    .order("position", { ascending: true })
    .order("product_id", { ascending: true });

  if (error) throw new Error(error.message);

  const joined = ((data ?? []) as CurationJoinRow[])
    .map((row) => {
      const product = unwrapProduct(row.products);
      if (!product) return null;
      return {
        id: String(row.id),
        position: Number(row.position),
        editorial_note: row.editorial_note,
        product,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return projectChloeEditFeedFromRows(
    joined,
    tenant.organizationId,
    options.limit,
  );
}

/** Convenience: StorefrontProduct[] for existing ChloeEditGrid. */
export async function getChloeEditStorefrontProducts(
  options: GetChloeEditFeedOptions = {},
): Promise<StorefrontProduct[]> {
  const feed = await getChloeEditFeed(options);
  return feed.map((item) => item.product);
}
