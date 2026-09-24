/**
 * Storefront presentation image resolution.
 * Prefer transparent packshot derivatives when present; else original source URL.
 * Client-safe — no sharp / filesystem.
 */
import { DERIVED_PACKSHOT_BY_SOURCE_KEY } from "./derived-packshot-map";
import { sourceImageKeyFromUrl } from "./storefront-image-key";

/**
 * Resolve a product image URL for customer-facing storefront display.
 * Never throws; always falls back to the source URL.
 */
export function resolveStorefrontImageUrl(
  sourceUrl: string | null | undefined,
): string | null {
  if (!sourceUrl?.trim()) return null;
  const key = sourceImageKeyFromUrl(sourceUrl.trim());
  const derived = DERIVED_PACKSHOT_BY_SOURCE_KEY[key];
  return derived ?? sourceUrl.trim();
}

export function resolveStorefrontImageUrls(
  urls: Array<string | null | undefined>,
): string[] {
  const out: string[] = [];
  for (const url of urls) {
    const resolved = resolveStorefrontImageUrl(url);
    if (resolved) out.push(resolved);
  }
  return out;
}
