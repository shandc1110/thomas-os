/**
 * Merchant-side Joybuy configuration for the controlled first-product launch.
 *
 * Values come from env (and optionally DB channel_catalog_mappings via merchant-mappings.ts).
 * Never invent documentation example IDs.
 */

export const JOYBUY_CHANNEL = "joybuy";

/** Controlled first product only. */
export const CT7013_INTERNAL_PRODUCT_ID = "3fe3be28-7bf2-4715-9155-bc1bb0ece79b";
export const CT7013_SKU = "CT7013";
export const CT7013_BRAND_NAME = "Mideer";

/** Only allowed host for the controlled first-product API test. */
export const JOYBUY_PRE_RELEASE_API_BASE_URL = "https://api-pre.joybuy.com/rest";

export type JoybuyMediaMode = "unset" | "external_url" | "omit";

export type JoybuyMerchantConfig = {
  shopId: string | null;
  scene: string | null;
  mideerBrandId: string | null;
  /** Category chosen for Body Magnet / CT7013 — merchant-defined. */
  ct7013CategoryId: string | null;
  /**
   * Channel-only list price for CT7013 (GBP). Does not write to public.products.
   * Null = unresolved — fail closed before product-schema if price is required.
   */
  ct7013ListPriceGbp: number | null;
  /**
   * Media policy:
   * - unset: fail closed (docs do not confirm raw URL acceptance in-repo)
   * - external_url: merchant explicitly allows sending Thomas image URLs
   * - omit: build schema without productImages
   */
  mediaMode: JoybuyMediaMode;
  apiBaseUrl: string | null;
  preReleaseOnly: boolean;
};

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function parsePrice(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function parseMediaMode(raw: string): JoybuyMediaMode {
  const v = raw.toLowerCase();
  if (v === "external_url") return "external_url";
  if (v === "omit") return "omit";
  return "unset";
}

function normalizeApiBase(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\/$/, "");
}

/** Read merchant Joybuy config from environment (no secrets logged by callers). */
export function getJoybuyMerchantConfigFromEnv(): JoybuyMerchantConfig {
  const apiBaseUrl = normalizeApiBase(read("JOYBUY_API_BASE_URL") || null);
  return {
    shopId: read("JOYBUY_SHOP_ID") || null,
    scene: read("JOYBUY_SCENE") || null,
    mideerBrandId: read("JOYBUY_BRAND_ID_MIDEER") || null,
    ct7013CategoryId: read("JOYBUY_CATEGORY_ID_CT7013") || null,
    ct7013ListPriceGbp: parsePrice(read("JOYBUY_CT7013_LIST_PRICE_GBP")),
    mediaMode: parseMediaMode(read("JOYBUY_MEDIA_MODE")),
    apiBaseUrl,
    preReleaseOnly: apiBaseUrl === JOYBUY_PRE_RELEASE_API_BASE_URL,
  };
}

export type JoybuyPrerequisiteIssue = {
  code: string;
  message: string;
};

/**
 * Fail-closed gate before any product-schema call.
 *
 * scene / brandId / categoryId are optional per postProductApply docs — do not
 * block solely because they are unset, and never invent documentation examples.
 */
export function assertJoybuyFirstProductPrerequisites(
  config: JoybuyMerchantConfig,
): JoybuyPrerequisiteIssue[] {
  const issues: JoybuyPrerequisiteIssue[] = [];

  if (!config.shopId) {
    issues.push({
      code: "MISSING_SHOP_ID",
      message: "JOYBUY_SHOP_ID is not configured (merchant shopId required).",
    });
  }
  if (config.ct7013ListPriceGbp == null) {
    issues.push({
      code: "MISSING_CHANNEL_PRICE",
      message:
        "JOYBUY_CT7013_LIST_PRICE_GBP is not configured. Do not use Thomas 95 CNY as UK Joybuy price.",
    });
  }
  if (config.mediaMode === "unset") {
    issues.push({
      code: "MISSING_MEDIA_POLICY",
      message:
        "JOYBUY_MEDIA_MODE is unset. Set external_url only if Joybuy docs confirm raw image URLs, otherwise omit — do not send Supabase URLs blindly.",
    });
  }
  if (!config.apiBaseUrl) {
    issues.push({
      code: "MISSING_API_BASE_URL",
      message: "JOYBUY_API_BASE_URL is not configured.",
    });
  } else if (config.apiBaseUrl !== JOYBUY_PRE_RELEASE_API_BASE_URL) {
    issues.push({
      code: "NOT_PRE_RELEASE",
      message:
        "JOYBUY_API_BASE_URL must be exactly https://api-pre.joybuy.com/rest for this controlled test.",
    });
  }

  return issues;
}

/** Presence-only check for API credentials — never returns secret values. */
export function assertJoybuyCredentialPresence(): JoybuyPrerequisiteIssue[] {
  const issues: JoybuyPrerequisiteIssue[] = [];
  if (!read("JOYBUY_APP_KEY")) {
    issues.push({ code: "MISSING_APP_KEY", message: "JOYBUY_APP_KEY is not configured." });
  }
  if (!read("JOYBUY_APP_SECRET")) {
    issues.push({ code: "MISSING_APP_SECRET", message: "JOYBUY_APP_SECRET is not configured." });
  }
  if (!read("JOYBUY_ACCESS_TOKEN")) {
    issues.push({
      code: "MISSING_ACCESS_TOKEN",
      message: "JOYBUY_ACCESS_TOKEN is not configured.",
    });
  }
  if (!read("JOYBUY_REQUEST_BIZ_ID")) {
    issues.push({
      code: "MISSING_REQUEST_BIZ_ID",
      message: "JOYBUY_REQUEST_BIZ_ID is not configured.",
    });
  }
  return issues;
}

export type CatalogMappingRow = {
  entity_type: "brand" | "category" | "shop" | "scene";
  internal_key: string;
  external_id: string;
  label: string | null;
};
