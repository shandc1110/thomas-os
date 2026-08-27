import type { JoybuyShipment } from "./types";

export type { JoybuyShipment } from "./types";

/**
 * Build a shipment update payload for Joybuy after Thomas dispatch.
 * Carrier / tracking field names from Joybuy API are applied later in the client adapter.
 */
export function buildJoybuyShipmentPayload(input: {
  externalOrderId: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
  lineSkus?: string[];
}): JoybuyShipment {
  const externalOrderId = input.externalOrderId?.trim();
  if (!externalOrderId) {
    throw new Error("Joybuy shipment requires externalOrderId.");
  }

  return {
    externalOrderId,
    carrier: input.carrier?.trim() || null,
    trackingNumber: input.trackingNumber?.trim() || null,
    shippedAt: input.shippedAt ?? null,
    lineSkus: (input.lineSkus ?? []).map((s) => s.trim()).filter(Boolean),
  };
}
