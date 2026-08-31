import type { Product } from "@/lib/types";

function tagValue(tags: string[], prefix: string): string | null {
  const hit = tags.find((t) => t.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

/** Map a Supabase products row to the storefront Product type. */
export function mapProduct(row: Record<string, unknown>): Product {
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];

  const variantGroupFromTag = tagValue(tags, "cbc_vgroup:");
  const variantCountFromTag = tagValue(tags, "cbc_vcount:");
  const isVariantSku = tags.includes("cbc_variant");
  const isListingTag = tags.includes("cbc_listing");

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
    assortment_status: (row.assortment_status as Product["assortment_status"]) ?? null,
    variant_group_key:
      (row.variant_group_key as string | null) ?? variantGroupFromTag ?? null,
    is_listing_product:
      row.is_listing_product != null
        ? Boolean(row.is_listing_product)
        : !isVariantSku || isListingTag,
    variant_option1:
      (row.variant_option1 as string | null) ?? tagValue(tags, "cbc_opt1:") ?? null,
    variant_option2:
      (row.variant_option2 as string | null) ?? tagValue(tags, "cbc_opt2:") ?? null,
    variant_count:
      row.variant_count != null
        ? Number(row.variant_count)
        : Number(variantCountFromTag ?? 1),
    weight_grams: (row.weight_grams as number | null) ?? null,
    length_mm: (row.length_mm as number | null) ?? null,
    width_mm: (row.width_mm as number | null) ?? null,
    height_mm: (row.height_mm as number | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}
