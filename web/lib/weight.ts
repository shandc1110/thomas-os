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

/** Volumetric weight from mm dimensions (courier divisor 5000 → kg, then grams). */
export function computeVolumetricWeightGrams(
  lengthMm: number | null | undefined,
  widthMm: number | null | undefined,
  heightMm: number | null | undefined,
): number | null {
  if (!lengthMm || !widthMm || !heightMm) return null;
  if (lengthMm <= 0 || widthMm <= 0 || heightMm <= 0) return null;
  const lengthCm = lengthMm / 10;
  const widthCm = widthMm / 10;
  const heightCm = heightMm / 10;
  const kg = (lengthCm * widthCm * heightCm) / 5000;
  return Math.round(kg * 1000);
}

/** Billable weight for shipping: higher of actual or volumetric. */
export function computeBillableWeightGrams(input: {
  weight_grams: number | null | undefined;
  length_mm: number | null | undefined;
  width_mm: number | null | undefined;
  height_mm: number | null | undefined;
}): number | null {
  const actual = input.weight_grams ?? 0;
  const volumetric = computeVolumetricWeightGrams(input.length_mm, input.width_mm, input.height_mm) ?? 0;
  if (actual <= 0 && volumetric <= 0) return null;
  return Math.max(actual, volumetric);
}
