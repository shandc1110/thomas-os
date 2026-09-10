import { describe, expect, it } from "vitest";
import {
  primaryStorefrontLabel,
  productToReadinessRow,
} from "@/lib/storefront/readiness-admin";
import { toStorefrontProduct } from "@/lib/storefront/map";
import type { Product } from "@/lib/types";

const CT7013_ID = "3fe3be28-7bf2-4715-9155-bc1bb0ece79b";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: CT7013_ID,
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
    cost_price: null,
    currency: "CNY",
    image_url:
      "https://yrpjtaqdwieavlhathvo.supabase.co/storage/v1/object/public/product-images/CT7013.jpg",
    gallery_images: [],
    stock: 0,
    presell_enabled: true,
    presell_quantity: 173,
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
    tags: ["cbc_listing"],
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("tags projection", () => {
  it("projects products.tags onto StorefrontProduct.tags", () => {
    const sf = toStorefrontProduct(baseProduct({ tags: ["cbc_listing", "cbc_vgroup:x"] }));
    expect(sf.tags).toEqual(["cbc_listing", "cbc_vgroup:x"]);
  });

  it("uses empty array when tags missing", () => {
    const sf = toStorefrontProduct(baseProduct({ tags: undefined as unknown as string[] }));
    expect(sf.tags).toEqual([]);
  });
});

describe("primaryStorefrontLabel", () => {
  it("returns READY when blocking fields are present", () => {
    const row = productToReadinessRow(baseProduct());
    expect(row.storefrontLabel).toBe("READY");
    expect(row.issues).toContain("MISSING_CATEGORY");
    expect(row.issues).toContain("MISSING_DESCRIPTION");
  });

  it("prefers NOT_ELIGIBLE over missing content when assortment is null", () => {
    const row = productToReadinessRow(baseProduct({ assortment_status: null }));
    expect(row.websiteEligible).toBe(false);
    expect(row.storefrontLabel).toBe("NOT_ELIGIBLE");
    expect(row.issues).toContain("NOT_ELIGIBLE");
  });

  it("excludes NULL assortment from eligibility (never auto-promote)", () => {
    const row = productToReadinessRow(baseProduct({ assortment_status: null }));
    expect(row.websiteEligible).toBe(false);
    expect(row.joybuyEligible).toBe(false);
  });

  it("labels MISSING_IMAGE when image absent on eligible product", () => {
    const row = productToReadinessRow(baseProduct({ image_url: null }));
    expect(row.storefrontLabel).toBe("MISSING_IMAGE");
    expect(primaryStorefrontLabel(toStorefrontProduct(baseProduct({ image_url: null })).readiness)).toBe(
      "MISSING_IMAGE",
    );
  });
});

describe("CT7013 readiness row", () => {
  it("projects CT7013 with tags and live PDP url", () => {
    const row = productToReadinessRow(baseProduct());
    expect(row.sku).toBe("CT7013");
    expect(row.assortmentStatus).toBe("active");
    expect(row.websiteEligible).toBe(true);
    expect(row.url).toContain(CT7013_ID);
    expect(row.url.startsWith("/products/")).toBe(true);
    expect(row.tags).toContain("cbc_listing");
    expect(row.storefrontLabel).toBe("READY");
    expect(row.shopifyCommercialStatus).toBe("NOT_READY");
    expect(row.joybuyCommercialStatus).toBe("NOT_READY");
  });

  it("marks channel commercial READY when GBP prices are set", () => {
    const row = productToReadinessRow(
      baseProduct({ shopify_price: 29.99, joybuy_price: 29.99 }),
    );
    expect(row.shopifyCommercialStatus).toBe("READY");
    expect(row.joybuyCommercialStatus).toBe("READY");
    expect(row.storefrontLabel).toBe("READY");
  });
});

describe("assortment vs readiness separation", () => {
  it("paused assortment is NOT_ELIGIBLE even with complete media", () => {
    const row = productToReadinessRow(baseProduct({ assortment_status: "paused" }));
    expect(row.assortmentStatus).toBe("paused");
    expect(row.storefrontLabel).toBe("NOT_ELIGIBLE");
  });

  it("retired assortment is NOT_ELIGIBLE", () => {
    const row = productToReadinessRow(baseProduct({ assortment_status: "retired" }));
    expect(row.storefrontLabel).toBe("NOT_ELIGIBLE");
  });
});
