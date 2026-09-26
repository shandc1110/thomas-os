/** Chosen by Chloe console selling-price helpers (CNY). */

const COST_MARKUP = 1.25;
const SHIPPING_PER_KG = 14;
const SHIPPING_MARKUP = 1.25;

/** New SKUs (e.g. first-time Sep 2026 PI lines): higher markup. */
const NEW_SKU_COST_MARKUP = 1.9;
const NEW_SKU_SHIPPING_PER_KG = 15;
const NEW_SKU_SHIPPING_MARKUP = 1.5;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Round up to a charm price ending in 9 (never below the raw price).
 * Examples: 23 → 29, 38 → 39, 29 → 29, 19.98 → 29.
 */
export function roundToNearestNine(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  const floorNine = Math.floor(price / 10) * 10 + 9;
  return floorNine >= price ? floorNine : floorNine + 10;
}

/**
 * Console selling price (legacy / restock):
 *   cost × 1.25 + weight_kg × 14 × 1.25
 * then rounded up to the nearest price ending in 9.
 */
export function calcConsolePrice(costCny: number, weightKg: number): number {
  const raw = costCny * COST_MARKUP + Math.max(weightKg, 0) * SHIPPING_PER_KG * SHIPPING_MARKUP;
  return roundToNearestNine(round2(raw));
}

/** New-SKU console price: cost × 1.9 + weight_kg × 15 × 1.5, round up to charm 9. */
export function calcNewSkuConsolePrice(costCny: number, weightKg: number): number {
  const raw =
    costCny * NEW_SKU_COST_MARKUP +
    Math.max(weightKg, 0) * NEW_SKU_SHIPPING_PER_KG * NEW_SKU_SHIPPING_MARKUP;
  return roundToNearestNine(round2(raw));
}

export function calcConsolePriceFromGrams(
  costCny: number,
  weightGrams: number | null | undefined,
): number {
  return calcConsolePrice(costCny, Math.max((weightGrams ?? 0) / 1000, 0));
}

export function calcNewSkuConsolePriceFromGrams(
  costCny: number,
  weightGrams: number | null | undefined,
): number {
  return calcNewSkuConsolePrice(costCny, Math.max((weightGrams ?? 0) / 1000, 0));
}
