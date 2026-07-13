/** Fixed CNY → GBP conversion rate: ¥9.25 = £1 */
export const CNY_TO_GBP_RATE = 9.25;

export type OrderCurrency = "CNY" | "GBP";

export function normaliseCurrency(value: string | null | undefined): OrderCurrency {
  return value?.trim().toUpperCase() === "GBP" ? "GBP" : "CNY";
}

/** Convert a CNY amount to GBP using the fixed rate. */
export function convertCnyToGbp(cnyAmount: number): number {
  return Math.round((cnyAmount / CNY_TO_GBP_RATE) * 100) / 100;
}

/** Return the order price for the chosen currency (catalog prices are stored in CNY). */
export function priceForCurrency(cnyPrice: number, currency: string | null | undefined): number {
  const code = normaliseCurrency(currency);
  return code === "GBP" ? convertCnyToGbp(cnyPrice) : cnyPrice;
}
