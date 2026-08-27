/** Chosen by Chloe console selling-price helpers (CNY). */

const COST_MARKUP = 1.25;
const SHIPPING_PER_KG = 14;
const SHIPPING_MARKUP = 1.25;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Round up to a charm price ending in 9.
 * Examples: 23 → 29, 38 → 39, 29 → 29.
 */
export function roundToNearestNine(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  return Math.ceil(price / 10) * 10 - 1;
}

/**
 * Console selling price:
 *   cost × 1.25 + weight_kg × 14 × 1.25
 * then rounded up to the nearest price ending in 9.
 */
export function calcConsolePrice(costCny: number, weightKg: number): number {
  const raw = costCny * COST_MARKUP + Math.max(weightKg, 0) * SHIPPING_PER_KG * SHIPPING_MARKUP;
  return roundToNearestNine(round2(raw));
}

export function calcConsolePriceFromGrams(
  costCny: number,
  weightGrams: number | null | undefined,
): number {
  return calcConsolePrice(costCny, Math.max((weightGrams ?? 0) / 1000, 0));
}
