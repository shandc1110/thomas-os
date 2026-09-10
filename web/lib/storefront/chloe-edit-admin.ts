/**
 * Staff admin for Chloe's Edit curation.
 * Mutations only touch chloe_edit_products — never assortment, price, or channel data.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "@/lib/format";
import { mapProduct } from "@/lib/products/map-product";
import { productUrl } from "@/lib/products/slug";
import { resolveChannelCommercial } from "./commercial";
import { resolveStorefrontImageUrl } from "@/lib/products/storefront-image";

export type ChloeEditAdminRow = {
  curationId: string;
  productId: string;
  position: number;
  editorialNote: string | null;
  sku: string | null;
  name: string;
  brand: string | null;
  assortmentStatus: string | null;
  primaryImage: string | null;
  shopifyPriceLabel: string;
  shopifyPriceConfigured: boolean;
  pdpPath: string;
  updatedAt: string | null;
};

export type ChloeEditCandidateRow = {
  productId: string;
  sku: string | null;
  name: string;
  brand: string | null;
  assortmentStatus: string | null;
  primaryImage: string | null;
  shopifyPriceLabel: string;
  shopifyPriceConfigured: boolean;
  alreadyCurated: boolean;
  pdpPath: string;
};

function shopifyLabel(product: ReturnType<typeof mapProduct>): {
  label: string;
  configured: boolean;
} {
  const commercial = resolveChannelCommercial(product, "shopify");
  if (
    commercial.priceStatus === "configured" &&
    commercial.channelPrice != null &&
    commercial.channelCurrency
  ) {
    return {
      label: formatPrice(commercial.channelPrice, commercial.channelCurrency),
      configured: true,
    };
  }
  return { label: "Price unavailable", configured: false };
}

function toAdminRow(
  curation: {
    id: string;
    position: number;
    editorial_note: string | null;
    updated_at: string | null;
    product_id: string;
  },
  productRow: Record<string, unknown>,
): ChloeEditAdminRow {
  const product = mapProduct(productRow);
  const shopify = shopifyLabel(product);
  return {
    curationId: String(curation.id),
    productId: String(product.id),
    position: Number(curation.position),
    editorialNote: curation.editorial_note?.trim() || null,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    assortmentStatus: product.assortment_status,
    primaryImage: resolveStorefrontImageUrl(product.image_url),
    shopifyPriceLabel: shopify.label,
    shopifyPriceConfigured: shopify.configured,
    pdpPath: productUrl(product),
    updatedAt: curation.updated_at,
  };
}

export async function listChloeEditAdmin(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: ChloeEditAdminRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("chloe_edit_products")
    .select(
      "id, position, editorial_note, updated_at, product_id, products!inner(*)",
    )
    .eq("organization_id", organizationId)
    .order("position", { ascending: true })
    .order("product_id", { ascending: true });

  if (error) return { rows: [], error: error.message };

  const rows: ChloeEditAdminRow[] = [];
  for (const raw of data ?? []) {
    const entry = raw as {
      id: string;
      position: number;
      editorial_note: string | null;
      updated_at: string | null;
      product_id: string;
      products: Record<string, unknown> | Record<string, unknown>[] | null;
    };
    const productRow = Array.isArray(entry.products)
      ? entry.products[0]
      : entry.products;
    if (!productRow) continue;
    if (String(productRow.organization_id) !== organizationId) continue;
    rows.push(toAdminRow(entry, productRow));
  }
  return { rows, error: null };
}

export async function searchChloeEditCandidates(
  supabase: SupabaseClient,
  organizationId: string,
  query: string,
  limit = 30,
): Promise<{ rows: ChloeEditCandidateRow[]; error: string | null }> {
  const q = query.trim();
  if (q.length < 1) return { rows: [], error: null };

  const { data: curated, error: curatedError } = await supabase
    .from("chloe_edit_products")
    .select("product_id")
    .eq("organization_id", organizationId);

  if (curatedError) return { rows: [], error: curatedError.message };
  const curatedIds = new Set(
    (curated ?? []).map((r) => String((r as { product_id: string }).product_id)),
  );

  // Quote the pattern — spaces / commas break unquoted PostgREST filters.
  const escaped = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const term = `%${escaped}%`;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("organization_id", organizationId)
    .or(
      [
        `name.ilike."${term}"`,
        `sku.ilike."${term}"`,
        `brand.ilike."${term}"`,
      ].join(","),
    )
    .order("name", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) return { rows: [], error: error.message };

  const rows: ChloeEditCandidateRow[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const product = mapProduct(row);
    if (product.is_listing_product === false) continue;
    const shopify = shopifyLabel(product);
    rows.push({
      productId: String(product.id),
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      assortmentStatus: product.assortment_status,
      primaryImage: resolveStorefrontImageUrl(product.image_url),
      shopifyPriceLabel: shopify.label,
      shopifyPriceConfigured: shopify.configured,
      alreadyCurated: curatedIds.has(String(product.id)),
      pdpPath: productUrl(product),
    });
  }
  return { rows, error: null };
}

export async function addChloeEditProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
  options: { position?: number; editorialNote?: string | null } = {},
): Promise<{ row: ChloeEditAdminRow | null; error: string | null }> {
  const { data: productRow, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (productError) return { row: null, error: productError.message };
  if (!productRow) return { row: null, error: "Product not found in this organization." };

  const product = mapProduct(productRow as Record<string, unknown>);
  if (product.is_listing_product === false) {
    return { row: null, error: "Variant SKUs cannot be curated — use the listing product." };
  }

  let position = options.position;
  if (position == null || !Number.isFinite(position)) {
    const { data: maxRows } = await supabase
      .from("chloe_edit_products")
      .select("position")
      .eq("organization_id", organizationId)
      .order("position", { ascending: false })
      .limit(1);
    const maxPos =
      maxRows && maxRows.length > 0
        ? Number((maxRows[0] as { position: number }).position)
        : 0;
    position = maxPos > 0 ? maxPos + 10 : 10;
  }

  const note =
    options.editorialNote != null && options.editorialNote.trim()
      ? options.editorialNote.trim()
      : null;

  const { data: inserted, error } = await supabase
    .from("chloe_edit_products")
    .insert({
      organization_id: organizationId,
      product_id: productId,
      position,
      editorial_note: note,
      updated_at: new Date().toISOString(),
    })
    .select("id, position, editorial_note, updated_at, product_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { row: null, error: "Product is already in Chloe's Edit." };
    }
    return { row: null, error: error.message };
  }

  return {
    row: toAdminRow(
      inserted as {
        id: string;
        position: number;
        editorial_note: string | null;
        updated_at: string | null;
        product_id: string;
      },
      productRow as Record<string, unknown>,
    ),
    error: null,
  };
}

export async function removeChloeEditProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("chloe_edit_products")
    .delete()
    .eq("organization_id", organizationId)
    .eq("product_id", productId);

  return { error: error?.message ?? null };
}

export async function updateChloeEditProduct(
  supabase: SupabaseClient,
  organizationId: string,
  productId: string,
  patch: { position?: number; editorialNote?: string | null },
): Promise<{ row: ChloeEditAdminRow | null; error: string | null }> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.position != null) {
    if (!Number.isInteger(patch.position)) {
      return { row: null, error: "Position must be an integer." };
    }
    updates.position = patch.position;
  }
  if (patch.editorialNote !== undefined) {
    updates.editorial_note =
      patch.editorialNote != null && patch.editorialNote.trim()
        ? patch.editorialNote.trim()
        : null;
  }

  const { data: updated, error } = await supabase
    .from("chloe_edit_products")
    .update(updates)
    .eq("organization_id", organizationId)
    .eq("product_id", productId)
    .select("id, position, editorial_note, updated_at, product_id")
    .maybeSingle();

  if (error) return { row: null, error: error.message };
  if (!updated) return { row: null, error: "Curation record not found." };

  const { data: productRow, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (productError || !productRow) {
    return { row: null, error: productError?.message ?? "Product not found." };
  }

  return {
    row: toAdminRow(
      updated as {
        id: string;
        position: number;
        editorial_note: string | null;
        updated_at: string | null;
        product_id: string;
      },
      productRow as Record<string, unknown>,
    ),
    error: null,
  };
}

/** Reorder helper — apply explicit positions in one pass (staff UI). */
export async function reorderChloeEditProducts(
  supabase: SupabaseClient,
  organizationId: string,
  orderedProductIds: string[],
): Promise<{ error: string | null }> {
  let position = 10;
  for (const productId of orderedProductIds) {
    const { error } = await supabase
      .from("chloe_edit_products")
      .update({ position, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("product_id", productId);
    if (error) return { error: error.message };
    position += 10;
  }
  return { error: null };
}
