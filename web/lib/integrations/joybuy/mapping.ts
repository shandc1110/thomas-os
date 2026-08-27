import type { JoybuyExternalProductRef } from "./types";

/**
 * Idempotency helpers: Thomas SKU ↔ Joybuy external IDs.
 * Prefer a stable Joybuy external product ID when the official API provides one;
 * fall back to SKU matching within an organization.
 */

export type ExternalProductMap = Map<string, JoybuyExternalProductRef>;

/** Map key: organizationId + lowercase sku */
export function productMapKey(organizationId: string, sku: string): string {
  return `${organizationId.trim()}::${sku.trim().toLowerCase()}`;
}

export function buildExternalProductMap(
  refs: JoybuyExternalProductRef[],
): ExternalProductMap {
  const map: ExternalProductMap = new Map();
  for (const ref of refs) {
    if (!ref.sku?.trim()) continue;
    map.set(productMapKey(ref.organizationId, ref.sku), ref);
  }
  return map;
}

/**
 * Decide create vs update for a SKU sync.
 * Returns existing external IDs when present so callers do not create duplicates.
 */
export function resolveProductSyncAction(
  map: ExternalProductMap,
  organizationId: string,
  sku: string,
):
  | { action: "create" }
  | { action: "update"; externalProductId: string; externalSkuId: string | null } {
  const existing = map.get(productMapKey(organizationId, sku));
  if (existing?.externalProductId) {
    return {
      action: "update",
      externalProductId: existing.externalProductId,
      externalSkuId: existing.externalSkuId,
    };
  }
  return { action: "create" };
}

/** Merge a successful sync result into the in-memory map (for batch runs). */
export function upsertExternalProductRef(
  map: ExternalProductMap,
  ref: JoybuyExternalProductRef,
): void {
  if (!ref.sku?.trim()) return;
  map.set(productMapKey(ref.organizationId, ref.sku), ref);
}
