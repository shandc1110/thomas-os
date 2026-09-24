import { describe, expect, it } from "vitest";
import { isStorefrontAssortmentActive, isStorefrontEligible } from "@/lib/storefront/eligibility";
import { toStorefrontProduct } from "@/lib/storefront/map";
import { assessStorefrontReadiness } from "@/lib/storefront/readiness";
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
    stock: 177,
    presell_enabled: false,
    presell_quantity: 0,
    expected_arrival_month: null,
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

describe("storefront eligibility", () => {
  it("allows only assortment_status = active", () => {
    expect(isStorefrontAssortmentActive("active")).toBe(true);
    expect(isStorefrontAssortmentActive("paused")).toBe(false);
    expect(isStorefrontAssortmentActive("retired")).toBe(false);
    expect(isStorefrontAssortmentActive(null)).toBe(false);
    expect(isStorefrontAssortmentActive(undefined)).toBe(false);
  });

  it("never uses products.active as the storefront rule", () => {
    const inactiveButAssorted = baseProduct({ active: false, assortment_status: "active" });
    const activeButNullAssortment = baseProduct({ active: true, assortment_status: null });
    const activeButPaused = baseProduct({ active: true, assortment_status: "paused" });

    expect(isStorefrontEligible(inactiveButAssorted)).toBe(true);
    expect(isStorefrontEligible(activeButNullAssortment)).toBe(false);
    expect(isStorefrontEligible(activeButPaused)).toBe(false);
  });

  it("excludes non-listing variant SKU rows from shop cards", () => {
    expect(
      isStorefrontEligible(baseProduct({ is_listing_product: false, assortment_status: "active" })),
    ).toBe(false);
  });
});

describe("toStorefrontProduct mapping", () => {
  it("projects CT7013 without inventing missing copy", () => {
    const sf = toStorefrontProduct(baseProduct());

    expect(sf.productId).toBe(CT7013_ID);
    expect(sf.sku).toBe("CT7013");
    expect(sf.productName).toBe("mideer BODY MAGNET");
    expect(sf.brand).toBe("Mideer");
    expect(sf.productModel).toBe("CT7013");
    expect(sf.sourcePrice).toBe(95);
    expect(sf.sourceCurrency).toBe("CNY");
    // UK storefront channel — shopify_price unset → missing (never show ¥95)
    expect(sf.price).toBeNull();
    expect(sf.currency).toBe("GBP");
    expect(sf.priceStatus).toBe("missing");
    expect(sf.salePrice).toBeNull();
    expect(sf.collection).toBeNull();
    expect(sf.description).toBeNull();
    expect(sf.shortDescription).toBeNull();
    expect(sf.category).toBeNull();
    expect(sf.sellableStock).toBe(177);
    expect(sf.availabilityStatus).toBe("in_stock");
    expect(sf.websiteEligible).toBe(true);
    expect(sf.slug).toContain(CT7013_ID);
    expect(sf.url).toBe(`/products/${sf.slug}`);
    expect(sf.url.startsWith("/products/")).toBe(true);
    expect(sf.primaryImage).toBe("/product-images/derived/CT7013.png");
  });

  it("marks sold out when sellable stock is zero", () => {
    const sf = toStorefrontProduct(baseProduct({ stock: 0, presell_enabled: false }));
    expect(sf.availabilityStatus).toBe("sold_out");
    expect(sf.sellableStock).toBe(0);
    expect(sf.badges).toContain("Sold out");
  });

  it("marks preorder when only presell pool remains", () => {
    const sf = toStorefrontProduct(
      baseProduct({
        stock: 0,
        presell_enabled: true,
        presell_quantity: 5,
        expected_arrival_month: "2026-10",
      }),
    );
    expect(sf.availabilityStatus).toBe("preorder");
    expect(sf.sellableStock).toBe(5);
    expect(sf.availabilityMessage).toMatch(/Pre-order/);
  });

  it("does not invent description when source is empty", () => {
    const sf = toStorefrontProduct(baseProduct({ description: "  " }));
    expect(sf.description).toBeNull();
    expect(sf.readiness.issues).toContain("MISSING_DESCRIPTION");
  });
});

describe("storefront readiness", () => {
  it("reports READY for CT7013 with image, brand, community price, name despite missing category/description", () => {
    const sf = toStorefrontProduct(baseProduct());
    expect(sf.readiness.status).toBe("READY");
    expect(sf.readiness.issues).toContain("MISSING_CATEGORY");
    expect(sf.readiness.issues).toContain("MISSING_DESCRIPTION");
    expect(sf.readiness.issues).not.toContain("MISSING_IMAGE");
    expect(sf.readiness.issues).not.toContain("MISSING_PRICE");
    expect(sf.readiness.shopify.status).toBe("NOT_READY");
  });

  it("reports NOT_READY when image or community price missing", () => {
    const noImage = toStorefrontProduct(baseProduct({ image_url: null }));
    expect(noImage.readiness.status).toBe("NOT_READY");
    expect(noImage.readiness.issues).toContain("MISSING_IMAGE");

    const noPrice = toStorefrontProduct(baseProduct({ price: 0 }));
    expect(noPrice.readiness.status).toBe("NOT_READY");
    expect(noPrice.readiness.issues).toContain("MISSING_PRICE");
  });

  it("marks Shopify commercial READY when shopify_price is set", () => {
    const sf = toStorefrontProduct(baseProduct({ shopify_price: 29.99, joybuy_price: 29.99 }));
    expect(sf.price).toBe(29.99);
    expect(sf.currency).toBe("GBP");
    expect(sf.readiness.shopify.status).toBe("READY");
    expect(sf.readiness.joybuy.status).toBe("READY");
    expect(sf.sourcePrice).toBe(95);
  });

  it("reports NOT_ELIGIBLE when assortment is not active", () => {
    const sf = toStorefrontProduct(baseProduct({ assortment_status: null }));
    expect(sf.websiteEligible).toBe(false);
    expect(sf.readiness.issues).toContain("NOT_ELIGIBLE");
    expect(sf.readiness.status).toBe("NOT_READY");
  });

  it("assessStorefrontReadiness is deterministic for the same input", () => {
    const sf = toStorefrontProduct(baseProduct());
    const { readiness: _r, ...input } = sf;
    const a = assessStorefrontReadiness(input);
    const b = assessStorefrontReadiness(input);
    expect(a).toEqual(b);
  });
});

describe("slug stability on storefront projection", () => {
  it("keeps slug stable when stock and price change", () => {
    const a = toStorefrontProduct(baseProduct({ stock: 10, price: 95 }));
    const b = toStorefrontProduct(baseProduct({ stock: 0, price: 120 }));
    expect(a.slug).toBe(b.slug);
    expect(a.url).toBe(b.url);
  });
});
