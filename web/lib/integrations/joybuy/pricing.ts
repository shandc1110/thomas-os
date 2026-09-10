import type { Product } from "@/lib/types";
import { round2 } from "@/lib/pricing";
import { resolveChannelCommercial } from "@/lib/storefront/commercial";
import type { JoybuyMappedPrice } from "./types";

/**
 * Map Joybuy UK channel price (explicit GBP).
 * Never uses products.price / community CNY. Never FX-converts.
 */
export function buildJoybuyPricePayload(product: Product): JoybuyMappedPrice {
  const sku = (product.sku ?? "").trim();
  if (!sku) {
    throw new Error("Product SKU is required for Joybuy price mapping.");
  }

  const commercial = resolveChannelCommercial(product, "joybuy");
  const price =
    commercial.priceStatus === "configured" && commercial.channelPrice != null
      ? round2(commercial.channelPrice)
      : null;

  return {
    internalProductId: String(product.id),
    sku,
    price,
    currency: price != null ? "GBP" : null,
  };
}
