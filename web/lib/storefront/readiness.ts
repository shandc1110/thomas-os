import type { ChannelPriceStatus } from "./commercial";
import type {
  StorefrontProduct,
  StorefrontReadiness,
  StorefrontReadinessIssue,
} from "./types";

type ReadinessInput = Omit<StorefrontProduct, "readiness">;

/**
 * Critical content / assortment fields.
 * Description/category are reported but do not block READY in V1.
 * UK channel prices are NOT blocking here — see commercial readiness gates.
 */
const BLOCKING: StorefrontReadinessIssue[] = [
  "MISSING_NAME",
  "MISSING_PRICE",
  "MISSING_IMAGE",
  "MISSING_BRAND",
  "NOT_ELIGIBLE",
];

export type AssessStorefrontReadinessOptions = {
  shopifyPriceStatus: ChannelPriceStatus;
  joybuyPriceStatus: ChannelPriceStatus;
};

/**
 * Assess storefront readiness from projected fields — no invented content.
 * MISSING_PRICE refers to community/source price (sourcePrice), not Shopify GBP.
 */
export function assessStorefrontReadiness(
  product: ReadinessInput,
  options?: AssessStorefrontReadinessOptions,
): StorefrontReadiness {
  const issues: StorefrontReadinessIssue[] = [];

  if (!product.websiteEligible) issues.push("NOT_ELIGIBLE");
  if (!product.productName?.trim()) issues.push("MISSING_NAME");
  if (!product.sku?.trim()) issues.push("MISSING_SKU");
  if (!product.brand?.trim()) issues.push("MISSING_BRAND");
  // Community / source price — not the UK channel price.
  if (product.sourcePrice == null || !(product.sourcePrice > 0)) {
    issues.push("MISSING_PRICE");
  }
  if (!product.primaryImage?.trim()) issues.push("MISSING_IMAGE");
  if (!product.category?.trim()) issues.push("MISSING_CATEGORY");
  if (!product.description?.trim()) issues.push("MISSING_DESCRIPTION");

  const blocking = issues.filter((i) => BLOCKING.includes(i));

  const shopifyStatus =
    options?.shopifyPriceStatus ??
    (product.channel === "shopify" ? product.priceStatus : "missing");
  const joybuyStatus = options?.joybuyPriceStatus ?? "missing";

  return {
    status: blocking.length === 0 ? "READY" : "NOT_READY",
    issues,
    shopify: {
      status: shopifyStatus === "configured" ? "READY" : "NOT_READY",
      priceStatus: shopifyStatus,
    },
    joybuy: {
      status: joybuyStatus === "configured" ? "READY" : "NOT_READY",
      priceStatus: joybuyStatus,
    },
  };
}
