/**
 * Joybuy product-schema component builder (componentCode/value array → JSON string).
 *
 * Only includes components we can populate from Thomas data + merchant config.
 * Does not invent category-specific attributes, example IDs, or undocumented shapes.
 */

import type { Product } from "@/lib/types";
import { mapProductToJoybuy } from "./products";
import { buildJoybuyInventoryPayload } from "./inventory";
import { serializeJoybuyBody } from "./sign";
import type { JoybuyMerchantConfig } from "./merchant-config";
import { CT7013_SKU } from "./merchant-config";
import { resolveChannelCommercial } from "@/lib/storefront/commercial";

export type JoybuySchemaComponent = {
  componentCode: string;
  value: unknown;
};

export type JoybuyProductSchemaRequest = {
  schema: string;
  productId: null;
  shopId: string;
  /** Optional per Joybuy postProductApply — omit when unset. */
  categoryId?: string;
  /** Optional per Joybuy postProductApply — omit when unset. */
  scene?: string;
};

export type BuildCt7013SchemaResult =
  | { ok: true; components: JoybuySchemaComponent[]; request: JoybuyProductSchemaRequest }
  | { ok: false; blockers: string[] };

/**
 * Build the official component-array schema for CT7013 only.
 * Channel list price must come from joybuy_price GBP (durable), never Thomas 95 CNY.
 * Env JOYBUY_CT7013_LIST_PRICE_GBP remains a bootstrap fallback only when joybuy_price is unset.
 *
 * brand / categoryId / scene are included only when merchant-configured —
 * never invent documentation example IDs.
 */
export function buildCt7013ProductSchemaComponents(
  product: Product,
  merchant: JoybuyMerchantConfig,
): BuildCt7013SchemaResult {
  const blockers: string[] = [];

  if ((product.sku ?? "").trim() !== CT7013_SKU) {
    blockers.push(`Refusing non-CT7013 SKU: ${product.sku}`);
  }
  if (!merchant.shopId) blockers.push("shopId missing");

  const joybuyCommercial = resolveChannelCommercial(product, "joybuy");
  const listPriceGbp =
    joybuyCommercial.priceStatus === "configured"
      ? joybuyCommercial.channelPrice
      : merchant.ct7013ListPriceGbp;

  if (listPriceGbp == null || !(listPriceGbp > 0)) {
    blockers.push("Joybuy channel list price (GBP) unresolved");
  }
  if (merchant.mediaMode === "unset") {
    blockers.push("media policy unset");
  }

  if (blockers.length) return { ok: false, blockers };

  const mapped = mapProductToJoybuy(product);
  const inventory = buildJoybuyInventoryPayload(product);

  const components: JoybuySchemaComponent[] = [];

  // publishLanguage — UK language from merchant header default path (en_GB).
  components.push({
    componentCode: "publishLanguage",
    value: "en_GB",
  });

  // productName — use plain string value from Thomas name (no invented multi-language tree).
  components.push({
    componentCode: "productName",
    value: mapped.title,
  });

  // brand — Joybuy brand ID only when merchant-configured (never invent).
  if (merchant.mideerBrandId) {
    components.push({
      componentCode: "brand",
      value: merchant.mideerBrandId,
    });
  }

  components.push({
    componentCode: "productModel",
    value: mapped.sku,
  });

  if (merchant.mediaMode === "external_url") {
    if (!mapped.primaryImageUrl) {
      return { ok: false, blockers: ["mediaMode=external_url but product has no image_url"] };
    }
    components.push({
      componentCode: "productImages",
      value: [mapped.primaryImageUrl],
    });
  }
  // mediaMode=omit → do not include productImages

  if (mapped.description) {
    components.push({
      componentCode: "productDetails",
      value: mapped.description,
    });
  }

  // Do not invent countryOfOrigion — Thomas country_of_origin is null for CT7013.

  const skuEntry: Record<string, unknown> = {
    skuId: mapped.sku,
    skuName: mapped.title,
    listPrice: listPriceGbp,
    stock: inventory.quantity,
  };
  if (mapped.barcode) {
    skuEntry.upcEanCode = mapped.barcode;
    skuEntry.barcode = mapped.barcode;
  }
  if (merchant.mediaMode === "external_url" && mapped.primaryImageUrl) {
    skuEntry.skuImages = [mapped.primaryImageUrl];
  }

  components.push({
    componentCode: "skus",
    value: [skuEntry],
  });

  const schema = serializeJoybuyBody(components);
  const request: JoybuyProductSchemaRequest = {
    schema,
    productId: null,
    shopId: merchant.shopId!,
  };
  if (merchant.ct7013CategoryId) request.categoryId = merchant.ct7013CategoryId;
  if (merchant.scene) request.scene = merchant.scene;

  return { ok: true, components, request };
}

/** Safe preview for logs — no secrets. */
export function sanitizeProductSchemaPreview(request: JoybuyProductSchemaRequest): {
  shopId: string;
  categoryId: string | null;
  scene: string | null;
  productId: null;
  schemaComponents: JoybuySchemaComponent[];
} {
  return {
    shopId: request.shopId,
    categoryId: request.categoryId ?? null,
    scene: request.scene ?? null,
    productId: null,
    schemaComponents: JSON.parse(request.schema) as JoybuySchemaComponent[],
  };
}

/** Parse formal data[] shape and legacy single-object shape. */
export function parseProductSchemaCreateData(data: unknown): {
  productId: string | null;
  versionId: string | number | null;
} {
  if (Array.isArray(data) && data.length > 0) {
    return parseProductSchemaCreateData(data[0]);
  }
  if (!data || typeof data !== "object") {
    return { productId: null, versionId: null };
  }
  const obj = data as Record<string, unknown>;
  const productId =
    typeof obj.productId === "string"
      ? obj.productId
      : typeof obj.productId === "number"
        ? String(obj.productId)
        : null;
  const versionId =
    typeof obj.versionId === "string" || typeof obj.versionId === "number"
      ? obj.versionId
      : null;
  return { productId, versionId };
}
