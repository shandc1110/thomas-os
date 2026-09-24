/** Pure URL helpers for storefront presentation images (safe for client bundles). */

/** Basename key used for derivative mapping (strips query string). */
export function sourceImageKeyFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").pop() || url);
  } catch {
    const bare = url.split("?")[0] ?? url;
    return decodeURIComponent(bare.split("/").pop() || bare);
  }
}

export function derivedPackshotPublicPath(sourceKey: string): string {
  const stem = sourceKey.replace(/\.[^.]+$/i, "");
  return `/product-images/derived/${stem}.png`;
}
