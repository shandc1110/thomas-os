/** Product fields used for pre-sell / sellable stock calculations. */
export type PresellProductFields = {
  stock?: number | null;
  presell_enabled?: boolean | null;
  presell_quantity?: number | null;
  expected_arrival_month?: string | null;
};

export function getOnHandStock(product: PresellProductFields): number {
  return Math.max(product.stock ?? 0, 0);
}

export function getPresellStock(product: PresellProductFields): number {
  if (!product.presell_enabled) return 0;
  return Math.max(product.presell_quantity ?? 0, 0);
}

/** Total units a customer may add to cart (on-hand + pre-sell pool). */
export function getSellableStock(product: PresellProductFields): number {
  return getOnHandStock(product) + getPresellStock(product);
}

export function isPresellOnly(product: PresellProductFields): boolean {
  return getOnHandStock(product) <= 0 && getPresellStock(product) > 0;
}

/** Format `2026-08` → "August 2026". */
export function formatExpectedArrival(month: string | null | undefined): string | null {
  if (!month?.trim()) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return month;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return month;
  return new Date(year, monthIndex, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export const ARRIVAL_MONTH_OPTIONS = [
  { value: "2026-08", label: "August 2026" },
  { value: "2026-09", label: "September 2026" },
  { value: "2026-10", label: "October 2026" },
  { value: "2026-11", label: "November 2026" },
  { value: "2026-12", label: "December 2026" },
] as const;
