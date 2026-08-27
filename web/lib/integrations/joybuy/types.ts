/**
 * Joybuy Open Platform — shared types.
 *
 * Official Joybuy request/response field names are intentionally NOT assumed.
 * Mappers produce Thomas-owned payload shapes; the HTTP adapter will translate
 * them once Joybuy documentation is confirmed.
 */

export type JoybuyErrorCode =
  | "JOYBUY_NOT_CONFIGURED"
  | "JOYBUY_NOT_IMPLEMENTED"
  | "JOYBUY_INVALID_CONFIG"
  | "JOYBUY_MAPPING_ERROR"
  | "JOYBUY_SYNC_BLOCKED";

export type JoybuyResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      code: JoybuyErrorCode;
      message: string;
    };

/** Channel-neutral product payload derived from a Thomas Product. */
export type JoybuyMappedProduct = {
  internalProductId: string;
  sku: string;
  title: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  barcode: string | null;
  price: number | null;
  currency: string | null;
  primaryImageUrl: string | null;
  galleryImageUrls: string[];
  weightGrams: number | null;
  dimensionsMm: {
    length: number | null;
    width: number | null;
    height: number | null;
  };
  active: boolean;
  /** Opaque slot for official API fields later — never put secrets here. */
  attributes: Record<string, string | number | boolean | null>;
};

export type JoybuyMappedInventory = {
  internalProductId: string;
  sku: string;
  /** Sellable quantity for the channel (= getSellableStock). */
  quantity: number;
  onHand: number;
  presell: number;
  expectedArrivalMonth: string | null;
};

export type JoybuyMappedPrice = {
  internalProductId: string;
  sku: string;
  price: number | null;
  currency: string | null;
  /** Never include cost unless official API requires it. */
};

export type JoybuyAddress = {
  name: string | null;
  phone: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
};

export type JoybuyOrderLine = {
  externalLineId: string | null;
  sku: string | null;
  title: string | null;
  quantity: number;
  unitPrice: number | null;
  currency: string | null;
};

/**
 * Minimal Joybuy order shape we can verify without inventing API schemas.
 * Additional official fields belong in `raw` only after docs confirm them —
 * and must never include secrets.
 */
export type JoybuyOrder = {
  externalOrderId: string;
  externalOrderNumber: string | null;
  status: JoybuyOrderStatus;
  currency: string | null;
  placedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: JoybuyAddress | null;
  lines: JoybuyOrderLine[];
};

export type JoybuyOrderStatus =
  | "unknown"
  | "pending"
  | "paid"
  | "cancelled"
  | "shipped"
  | "completed";

export type JoybuyShipment = {
  externalOrderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  lineSkus: string[];
};

/** Idempotent link between Thomas product and Joybuy listing. */
export type JoybuyExternalProductRef = {
  organizationId: string;
  internalProductId: string;
  sku: string;
  externalProductId: string | null;
  externalSkuId: string | null;
};
