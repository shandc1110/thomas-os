import { describe, expect, it } from "vitest";
import {
  displayUnitPriceForCartLine,
  normaliseOrderPricingChannel,
  resolveAuthoritativeUnitPrice,
} from "@/lib/storefront/order-pricing";
import { convertCnyToGbp } from "@/lib/currency";
import type { Product } from "@/lib/types";

const CT7013_ID = "3fe3be28-7bf2-4715-9155-bc1bb0ece79b";

function ct7013(overrides: Partial<Product> = {}): Product {
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
    shopify_price: 29.99,
    joybuy_price: 29.99,
    cost_price: 45.13,
    currency: "CNY",
    image_url: null,
    gallery_images: [],
    stock: 10,
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

describe("UK Shopify order unit pricing", () => {
  it("resolves CT7013 shopify channel to £29.99 without FX", () => {
    const resolved = resolveAuthoritativeUnitPrice(ct7013(), "shopify", "GBP");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.unitPrice).toBe(29.99);
    expect(resolved.currency).toBe("GBP");
    expect(resolved.pricingChannel).toBe("shopify");
    expect(resolved.unitPrice).not.toBe(convertCnyToGbp(95));
  });

  it("rejects shopify channel when shopify_price is missing", () => {
    const resolved = resolveAuthoritativeUnitPrice(
      ct7013({ shopify_price: null }),
      "shopify",
      "GBP",
    );
    expect("error" in resolved).toBe(true);
  });

  it("rejects shopify channel when shopify_price is zero", () => {
    const resolved = resolveAuthoritativeUnitPrice(
      ct7013({ shopify_price: 0 }),
      "shopify",
      "GBP",
    );
    expect("error" in resolved).toBe(true);
  });

  it("rejects shopify channel when order currency is not GBP", () => {
    const resolved = resolveAuthoritativeUnitPrice(ct7013(), "shopify", "CNY");
    expect("error" in resolved).toBe(true);
  });

  it("never falls back to community CNY for shopify settlement", () => {
    const resolved = resolveAuthoritativeUnitPrice(
      ct7013({ shopify_price: null, price: 95 }),
      "shopify",
      "GBP",
    );
    expect("error" in resolved).toBe(true);
  });

  it("keeps community settlement on products.price CNY", () => {
    const resolved = resolveAuthoritativeUnitPrice(ct7013(), "community", "CNY");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.unitPrice).toBe(95);
    expect(resolved.currency).toBe("CNY");
    expect(resolved.pricingChannel).toBe("community");
  });

  it("community GBP still uses FX from products.price (portal behaviour)", () => {
    const resolved = resolveAuthoritativeUnitPrice(ct7013(), "community", "GBP");
    expect("error" in resolved).toBe(false);
    if ("error" in resolved) return;
    expect(resolved.unitPrice).toBe(convertCnyToGbp(95));
    expect(resolved.unitPrice).not.toBe(29.99);
  });

  it("quantity maths for CT7013 Shopify", () => {
    const resolved = resolveAuthoritativeUnitPrice(ct7013(), "shopify", "GBP");
    if ("error" in resolved) throw new Error(resolved.error);
    expect(Math.round(resolved.unitPrice * 2 * 100) / 100).toBe(59.98);
    expect(Math.round(resolved.unitPrice * 3 * 100) / 100).toBe(89.97);
  });

  it("isolates Shopify from Joybuy price changes", () => {
    const product = ct7013({ shopify_price: 29.99, joybuy_price: 32.99 });
    const shopify = resolveAuthoritativeUnitPrice(product, "shopify", "GBP");
    expect("error" in shopify).toBe(false);
    if ("error" in shopify) return;
    expect(shopify.unitPrice).toBe(29.99);
  });

  it("ignores client-like overrides — only DB fields matter", () => {
    // Simulate a product row as loaded from DB; no clientPrice field exists.
    const resolved = resolveAuthoritativeUnitPrice(
      ct7013({ shopify_price: 29.99, price: 95 }),
      "shopify",
      "GBP",
    );
    if ("error" in resolved) throw new Error(resolved.error);
    expect(resolved.unitPrice).toBe(29.99);
  });
});

describe("cart display helper", () => {
  it("shows Shopify GBP for UK lines", () => {
    const display = displayUnitPriceForCartLine(ct7013(), "shopify", "GBP");
    expect(display.unitPrice).toBe(29.99);
    expect(display.currency).toBe("GBP");
  });

  it("shows community CNY for portal lines", () => {
    const display = displayUnitPriceForCartLine(ct7013(), "community", "CNY");
    expect(display.unitPrice).toBe(95);
    expect(display.currency).toBe("CNY");
  });
});

describe("normaliseOrderPricingChannel", () => {
  it("defaults unknown values to community", () => {
    expect(normaliseOrderPricingChannel(undefined)).toBe("community");
    expect(normaliseOrderPricingChannel("SHOPIFY")).toBe("shopify");
    expect(normaliseOrderPricingChannel("community")).toBe("community");
  });
});
