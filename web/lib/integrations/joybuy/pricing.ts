import type { Product } from "@/lib/types";
import { round2 } from "@/lib/pricing";
import type { JoybuyMappedPrice } from "./types";

/**
 * Map Thomas catalog sell price for Joybuy.
 * Reuses existing pricing helpers (round2); does not send cost_price.
 */
export function buildJoybuyPricePayload(product: Product): JoybuyMappedPrice {
  const sku = (product.sku ?? "").trim();
  if (!sku) {
    throw new Error("Product SKU is required for Joybuy price mapping.");
  }

  const raw = product.price;
  const price =
    raw != null && Number.isFinite(raw) && raw > 0 ? round2(raw) : null;

  return {
    internalProductId: String(product.id),
    sku,
    price,
    currency: product.currency?.trim() || null,
  };
}
