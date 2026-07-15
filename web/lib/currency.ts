import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

export type OrderCurrency = "CNY" | "GBP";

export function normaliseCurrency(value: string | null | undefined): OrderCurrency {
  return value?.trim().toUpperCase() === "GBP" ? "GBP" : "CNY";
}

function getCnyToGbpRate(): number {
  return getActiveTenant().commerce.cnyToGbpRate;
}

function getCnyToGbpMarkup(): number {
  return getActiveTenant().commerce.cnyToGbpMarkup;
}

/** Tenant base CNY→GBP rate for display (before markup). */
export function getDisplayCnyToGbpRate(): number {
  return getCnyToGbpRate();
}

/** Tenant FX markup multiplier (e.g. 1.1). */
export function getDisplayCnyToGbpMarkup(): number {
  return getCnyToGbpMarkup();
}

/**
 * Convert a CNY amount to GBP using the tenant exchange rate + markup.
 * Example: ¥925 / 9.25 × 1.1 = £110.
 */
export function convertCnyToGbp(cnyAmount: number): number {
  const rate = getCnyToGbpRate();
  const markup = getCnyToGbpMarkup();
  return Math.round((cnyAmount / rate) * markup * 100) / 100;
}

/** Return the order price for the chosen currency (catalog prices are stored in CNY). */
export function priceForCurrency(cnyPrice: number, currency: string | null | undefined): number {
  const code = normaliseCurrency(currency);
  return code === "GBP" ? convertCnyToGbp(cnyPrice) : cnyPrice;
}

/** @deprecated Use getActiveTenant().commerce.cnyToGbpRate */
export const CNY_TO_GBP_RATE = 9.25;
