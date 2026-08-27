import type { Product } from "@/lib/types";
import type { JoybuyMappedProduct } from "./types";

function asId(id: string | number): string {
  return String(id);
}

function normalizeSku(sku: string | null | undefined): string {
  return (sku ?? "").trim();
}

function normalizeGallery(images: string[] | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean);
}

/**
 * Map a Thomas Product to a Joybuy channel payload.
 * Official Joybuy field names are applied later in the HTTP adapter.
 */
export function mapProductToJoybuy(product: Product): JoybuyMappedProduct {
  const sku = normalizeSku(product.sku);
  if (!sku) {
    throw new Error("Product SKU is required for Joybuy mapping.");
  }

  const gallery = normalizeGallery(product.gallery_images);
  const primary = product.image_url?.trim() || gallery[0] || null;

  return {
    internalProductId: asId(product.id),
    sku,
    title: product.name?.trim() || sku,
    brand: product.brand?.trim() || null,
    category: product.category?.trim() || null,
    description: product.description?.trim() || null,
    barcode: product.barcode?.trim() || null,
    price: product.price != null && Number.isFinite(product.price) ? product.price : null,
    currency: product.currency?.trim() || null,
    primaryImageUrl: primary,
    galleryImageUrls: gallery,
    weightGrams:
      product.weight_grams != null && Number.isFinite(product.weight_grams)
        ? product.weight_grams
        : null,
    dimensionsMm: {
      length: product.length_mm ?? null,
      width: product.width_mm ?? null,
      height: product.height_mm ?? null,
    },
    active: product.active !== false && product.status !== "discontinued",
    attributes: {
      status: product.status,
      retail_price: product.retail_price,
      // cost_price intentionally omitted — do not send to Joybuy by default
    },
  };
}

export function buildJoybuyProductPayload(product: Product): JoybuyMappedProduct {
  return mapProductToJoybuy(product);
}
