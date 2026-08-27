import type { Product } from "@/lib/types";
import {
  getOnHandStock,
  getPresellStock,
  getSellableStock,
} from "@/lib/presell";
import type { JoybuyMappedInventory } from "./types";

/**
 * Build inventory payload from Thomas sellable stock.
 * Does not invent a second stock source — reuses getSellableStock().
 */
export function buildJoybuyInventoryPayload(product: Product): JoybuyMappedInventory {
  const sku = (product.sku ?? "").trim();
  if (!sku) {
    throw new Error("Product SKU is required for Joybuy inventory mapping.");
  }

  return {
    internalProductId: String(product.id),
    sku,
    quantity: getSellableStock(product),
    onHand: getOnHandStock(product),
    presell: getPresellStock(product),
    expectedArrivalMonth: product.expected_arrival_month?.trim() || null,
  };
}
