export type WeightLineItem = {
  weight_grams: number | null | undefined;
  quantity: number;
};

/** Sum of weight_grams × quantity across all line items. */
export function computeTotalWeightGrams(items: WeightLineItem[]): number {
  return items.reduce((sum, item) => {
    const grams = item.weight_grams ?? 0;
    return sum + grams * item.quantity;
  }, 0);
}

/** Format grams as kilograms with two decimal places, e.g. "1.84 kg". */
export function formatWeightKg(grams: number | null | undefined): string {
  const g = grams ?? 0;
  if (g <= 0) return "—";
  const kg = g / 1000;
  return `${kg.toFixed(2)} kg`;
}

/** Convert grams to kilograms for Shopify weight fields. */
export function gramsToKg(grams: number): number {
  return Math.round((grams / 1000) * 1000) / 1000;
}
