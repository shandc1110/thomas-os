/**
 * Deterministic normalization for order consolidation matching.
 * Safe formatting only — no fuzzy address abbreviation expansion.
 */

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Name: trim, collapse whitespace, lowercase for comparison. */
export function normalizeCustomerName(value: string | null | undefined): string {
  return collapseWhitespace(value ?? "").toLowerCase();
}

/** Email: trim + lowercase. */
export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Delivery address: trim, treat line breaks as spaces, collapse whitespace, lowercase.
 * Does NOT expand St→Street or similar.
 */
export function normalizeDeliveryAddress(value: string | null | undefined): string {
  const raw = (value ?? "").replace(/[\r\n]+/g, " ");
  return collapseWhitespace(raw).toLowerCase();
}

export function normalizePostcode(value: string | null | undefined): string {
  return collapseWhitespace(value ?? "").toLowerCase();
}

export function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Match key requires ALL of: name + email + address (+ postcode segment) + currency.
 * Empty required fields produce empty string (caller treats as ineligible).
 */
export function buildConsolidationMatchKey(input: {
  customerName: string | null | undefined;
  email: string | null | undefined;
  address: string | null | undefined;
  postcode?: string | null | undefined;
  currency: string | null | undefined;
}): string {
  const name = normalizeCustomerName(input.customerName);
  const email = normalizeEmail(input.email);
  const address = normalizeDeliveryAddress(input.address);
  const postcode = normalizePostcode(input.postcode);
  const currency = normalizeCurrency(input.currency);

  if (!name || !email || !address || !currency) return "";

  return [name, email, address, postcode, currency].join("|");
}
