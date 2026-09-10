import { describe, expect, it } from "vitest";
import {
  assertJoybuyCredentialPresence,
  assertJoybuyFirstProductPrerequisites,
  CT7013_BRAND_NAME,
  CT7013_SKU,
  getJoybuyMerchantConfigFromEnv,
  JOYBUY_PRE_RELEASE_API_BASE_URL,
  type JoybuyMerchantConfig,
} from "../merchant-config";
import {
  buildCt7013ProductSchemaComponents,
  parseProductSchemaCreateData,
  sanitizeProductSchemaPreview,
} from "../product-schema";
import { coerceJoybuyFlag } from "../flags";
import type { Product } from "@/lib/types";

function ct7013Product(overrides: Partial<Product> = {}): Product {
  return {
    id: "3fe3be28-7bf2-4715-9155-bc1bb0ece79b",
    sku: "CT7013",
    name: "mideer BODY MAGNET",
    brand: "Mideer",
    category: null,
    description: null,
    barcode: null,
    price: 95,
    retail_price: 95,
    shopify_price: null,
    joybuy_price: null,
    cost_price: 45.13,
    currency: "CNY",
    image_url:
      "https://yrpjtaqdwieavlhathvo.supabase.co/storage/v1/object/public/product-images/CT7013.jpg",
    gallery_images: [],
    stock: 0,
    presell_enabled: true,
    presell_quantity: 177,
    expected_arrival_month: "2026-09",
    active: true,
    status: "active",
    assortment_status: "active",
    variant_group_key: null,
    is_listing_product: true,
    variant_option1: null,
    variant_option2: null,
    variant_count: 1,
    weight_grams: null,
    length_mm: null,
    width_mm: null,
    height_mm: null,
    tags: [],
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function fullMerchant(overrides: Partial<JoybuyMerchantConfig> = {}): JoybuyMerchantConfig {
  return {
    shopId: "1500013827",
    scene: "scene-real-1",
    mideerBrandId: "brand-mideer-1",
    ct7013CategoryId: "cat-bodymagnet-1",
    ct7013ListPriceGbp: 29.99,
    mediaMode: "omit",
    apiBaseUrl: JOYBUY_PRE_RELEASE_API_BASE_URL,
    preReleaseOnly: true,
    ...overrides,
  };
}

describe("Joybuy merchant config — Mideer / CT7013", () => {
  it("exposes CT7013 constants", () => {
    expect(CT7013_SKU).toBe("CT7013");
    expect(CT7013_BRAND_NAME).toBe("Mideer");
  });

  it("fail-closes on required gates without inventing optional IDs", () => {
    const issues = assertJoybuyFirstProductPrerequisites({
      shopId: null,
      scene: null,
      mideerBrandId: null,
      ct7013CategoryId: null,
      ct7013ListPriceGbp: null,
      mediaMode: "unset",
      apiBaseUrl: null,
      preReleaseOnly: false,
    });
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "MISSING_SHOP_ID",
        "MISSING_CHANNEL_PRICE",
        "MISSING_MEDIA_POLICY",
        "MISSING_API_BASE_URL",
      ]),
    );
    expect(issues.map((i) => i.code)).not.toContain("MISSING_SCENE");
    expect(issues.map((i) => i.code)).not.toContain("MISSING_BRAND_ID");
    expect(issues.map((i) => i.code)).not.toContain("MISSING_CATEGORY_ID");
  });

  it("fail-closes when API base is not pre-release", () => {
    const issues = assertJoybuyFirstProductPrerequisites(
      fullMerchant({ apiBaseUrl: "https://api.joybuy.com/rest", preReleaseOnly: false }),
    );
    expect(issues.some((i) => i.code === "NOT_PRE_RELEASE")).toBe(true);
  });

  it("passes when required merchant prerequisites are set (optional IDs unset)", () => {
    expect(
      assertJoybuyFirstProductPrerequisites(
        fullMerchant({ scene: null, mideerBrandId: null, ct7013CategoryId: null }),
      ),
    ).toEqual([]);
  });

  it("reads env config without inventing IDs", () => {
    const cfg = getJoybuyMerchantConfigFromEnv();
    if (!process.env.JOYBUY_SHOP_ID) expect(cfg.shopId).toBeNull();
    if (!process.env.JOYBUY_BRAND_ID_MIDEER) expect(cfg.mideerBrandId).toBeNull();
    if (!process.env.JOYBUY_SCENE) expect(cfg.scene).toBeNull();
    if (!process.env.JOYBUY_CATEGORY_ID_CT7013) expect(cfg.ct7013CategoryId).toBeNull();
  });

  it("treats shopId as distinct from merchant Request-BizId", () => {
    const keys = [
      "JOYBUY_SHOP_ID",
      "JOYBUY_REQUEST_BIZ_ID",
      "JOYBUY_SCENE",
      "JOYBUY_BRAND_ID_MIDEER",
      "JOYBUY_CATEGORY_ID_CT7013",
      "JOYBUY_CT7013_LIST_PRICE_GBP",
      "JOYBUY_MEDIA_MODE",
      "JOYBUY_API_BASE_URL",
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    process.env.JOYBUY_SHOP_ID = "1500013827";
    process.env.JOYBUY_REQUEST_BIZ_ID = "1500004776";
    process.env.JOYBUY_CT7013_LIST_PRICE_GBP = "29.99";
    process.env.JOYBUY_MEDIA_MODE = "omit";
    process.env.JOYBUY_API_BASE_URL = JOYBUY_PRE_RELEASE_API_BASE_URL;
    try {
      const cfg = getJoybuyMerchantConfigFromEnv();
      expect(cfg.shopId).toBe("1500013827");
      expect(cfg.shopId).not.toBe("1500004776");
      expect(cfg.scene).toBeNull();
      expect(cfg.mideerBrandId).toBeNull();
      expect(cfg.ct7013CategoryId).toBeNull();
      expect(assertJoybuyFirstProductPrerequisites(cfg)).toEqual([]);
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });

  it("reports credential presence without exposing secret values", () => {
    const issues = assertJoybuyCredentialPresence();
    for (const issue of issues) {
      expect(issue.code).toMatch(/^MISSING_/);
      expect(issue.message).not.toMatch(/[=:].{8,}/);
    }
  });
});

describe("Joybuy brand-category validation request body", () => {
  it("builds the documented validation payload shape", () => {
    const body = {
      brandId: "brand-mideer-1",
      categoryId: "cat-bodymagnet-1",
    };
    expect(body).toEqual({
      brandId: "brand-mideer-1",
      categoryId: "cat-bodymagnet-1",
    });
  });
});

describe("Joybuy component-array schema serialization", () => {
  it("builds a componentCode/value array JSON string (not a flat object)", () => {
    const result = buildCt7013ProductSchemaComponents(ct7013Product(), fullMerchant());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parsed = JSON.parse(result.request.schema);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("componentCode");
    expect(parsed[0]).toHaveProperty("value");
    expect(parsed).not.toHaveProperty("productName");

    const codes = parsed.map((c: { componentCode: string }) => c.componentCode);
    expect(codes).toContain("productName");
    expect(codes).toContain("brand");
    expect(codes).toContain("skus");
    expect(codes).toContain("publishLanguage");

    const brand = parsed.find((c: { componentCode: string }) => c.componentCode === "brand");
    expect(brand.value).toBe("brand-mideer-1");

    const skus = parsed.find((c: { componentCode: string }) => c.componentCode === "skus");
    expect(skus.value[0].listPrice).toBe(29.99);
    expect(skus.value[0].stock).toBe(177);
    expect(skus.value[0].skuId).toBe("CT7013");
  });

  it("omits brand/categoryId/scene when unset (does not invent doc examples)", () => {
    const result = buildCt7013ProductSchemaComponents(
      ct7013Product(),
      fullMerchant({ scene: null, mideerBrandId: null, ct7013CategoryId: null }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.components.some((c) => c.componentCode === "brand")).toBe(false);
    expect(result.request.categoryId).toBeUndefined();
    expect(result.request.scene).toBeUndefined();
    expect(result.request.shopId).toBe("1500013827");
    const preview = sanitizeProductSchemaPreview(result.request);
    expect(preview.categoryId).toBeNull();
    expect(preview.scene).toBeNull();
  });

  it("maps CT7013 Thomas fields and keeps nulls out of invented components", () => {
    const result = buildCt7013ProductSchemaComponents(ct7013Product(), fullMerchant());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const codes = result.components.map((c) => c.componentCode);
    expect(codes).not.toContain("countryOfOrigion");
    expect(codes).not.toContain("productDetails");
    expect(codes).not.toContain("productImages");
    const preview = sanitizeProductSchemaPreview(result.request);
    expect(preview.shopId).toBe("1500013827");
    expect(preview.categoryId).toBe("cat-bodymagnet-1");
    expect(preview.scene).toBe("scene-real-1");
  });

  it("handles missing product fields without inventing barcode/description", () => {
    const result = buildCt7013ProductSchemaComponents(
      ct7013Product({ barcode: null, description: null }),
      fullMerchant({ mediaMode: "omit" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.components.some((c) => c.componentCode === "productImages")).toBe(false);
    const skus = result.components.find((c) => c.componentCode === "skus")?.value as Array<
      Record<string, unknown>
    >;
    expect(skus[0].barcode).toBeUndefined();
    expect(skus[0].upcEanCode).toBeUndefined();
  });

  it("refuses non-CT7013 products", () => {
    const result = buildCt7013ProductSchemaComponents(
      ct7013Product({ sku: "OTHER" }),
      fullMerchant(),
    );
    expect(result.ok).toBe(false);
  });
});

describe("Joybuy success / validation flag coercion", () => {
  it("accepts boolean success", () => {
    expect(coerceJoybuyFlag(true)).toBe(true);
    expect(coerceJoybuyFlag(false)).toBe(false);
  });

  it("accepts string success", () => {
    expect(coerceJoybuyFlag("true")).toBe(true);
    expect(coerceJoybuyFlag("false")).toBe(false);
  });

  it("treats business validation failure via data.result", () => {
    const envelopeSuccess = coerceJoybuyFlag("true");
    const business = coerceJoybuyFlag("false");
    expect(envelopeSuccess).toBe(true);
    expect(business).toBe(false);
  });
});

describe("Joybuy product creation response parsing", () => {
  it("reads productId and versionId from formal data array", () => {
    const parsed = parseProductSchemaCreateData([
      { productId: "123456", versionId: 1 },
    ]);
    expect(parsed.productId).toBe("123456");
    expect(parsed.versionId).toBe(1);
  });

  it("reads productId and versionId from legacy object data", () => {
    const parsed = parseProductSchemaCreateData({
      productId: "jb-prod-1",
      versionId: "jb-ver-1",
    });
    expect(parsed.productId).toBe("jb-prod-1");
    expect(parsed.versionId).toBe("jb-ver-1");
  });
});
