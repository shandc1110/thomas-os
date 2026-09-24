import { describe, expect, it } from "vitest";
import {
  resolveChannelCommercial,
} from "@/lib/storefront/commercial";
import { toStorefrontProduct } from "@/lib/storefront/map";
import { buildJoybuyPricePayload } from "@/lib/integrations/joybuy/pricing";
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
    image_url:
      "https://yrpjtaqdwieavlhathvo.supabase.co/storage/v1/object/public/product-images/CT7013.jpg",
    gallery_images: [],
    stock: 177,
    presell_enabled: true,
    presell_quantity: 50,
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

describe("channel commercial pricing", () => {
  it("keeps CT7013 community at 95 CNY", () => {
    const community = resolveChannelCommercial(ct7013(), "community");
    expect(community.sourcePrice).toBe(95);
    expect(community.sourceCurrency).toBe("CNY");
    expect(community.channelPrice).toBe(95);
    expect(community.channelCurrency).toBe("CNY");
    expect(community.priceStatus).toBe("configured");
  });

  it("resolves CT7013 Shopify to 29.99 GBP", () => {
    const shopify = resolveChannelCommercial(ct7013(), "shopify");
    expect(shopify.channelPrice).toBe(29.99);
    expect(shopify.channelCurrency).toBe("GBP");
    expect(shopify.priceStatus).toBe("configured");
    expect(shopify.sourcePrice).toBe(95);
    expect(shopify.sourceCurrency).toBe("CNY");
  });

  it("resolves CT7013 Joybuy to 29.99 GBP", () => {
    const joybuy = resolveChannelCommercial(ct7013(), "joybuy");
    expect(joybuy.channelPrice).toBe(29.99);
    expect(joybuy.channelCurrency).toBe("GBP");
    expect(joybuy.priceStatus).toBe("configured");
  });

  it("allows Shopify and Joybuy to differ without touching source", () => {
    const product = ct7013({ shopify_price: 29.99, joybuy_price: 32.99 });
    expect(resolveChannelCommercial(product, "shopify").channelPrice).toBe(29.99);
    expect(resolveChannelCommercial(product, "joybuy").channelPrice).toBe(32.99);
    expect(resolveChannelCommercial(product, "community").channelPrice).toBe(95);
    expect(product.price).toBe(95);
    expect(product.currency).toBe("CNY");
  });

  it("detects missing Shopify GBP without falling back to CNY", () => {
    const shopify = resolveChannelCommercial(
      ct7013({ shopify_price: null }),
      "shopify",
    );
    expect(shopify.priceStatus).toBe("missing");
    expect(shopify.channelPrice).toBeNull();
    expect(shopify.sourcePrice).toBe(95);
  });

  it("detects missing Joybuy GBP without using products.price or shopify_price", () => {
    const joybuy = resolveChannelCommercial(
      ct7013({ joybuy_price: null, shopify_price: 29.99 }),
      "joybuy",
    );
    expect(joybuy.priceStatus).toBe("missing");
    expect(joybuy.channelPrice).toBeNull();
  });

  it("never FX-converts community CNY into Shopify GBP", () => {
    const shopify = resolveChannelCommercial(
      ct7013({ shopify_price: null, price: 95, currency: "CNY" }),
      "shopify",
    );
    expect(shopify.priceStatus).toBe("missing");
    expect(shopify.channelPrice).not.toBe(95);
  });

  it("accepts native GBP source as Shopify when shopify_price unset (non-Mideer)", () => {
    const micro = ct7013({
      brand: "Micro Scooters",
      sku: "MIMSE18RSE",
      price: 119.95,
      currency: "GBP",
      shopify_price: null,
      joybuy_price: null,
    });
    const shopify = resolveChannelCommercial(micro, "shopify");
    expect(shopify.priceStatus).toBe("configured");
    expect(shopify.channelPrice).toBe(119.95);
    expect(shopify.channelCurrency).toBe("GBP");
  });
});

describe("storefront Shopify projection", () => {
  it("projects /shop price from Shopify GBP for CT7013", () => {
    const sf = toStorefrontProduct(ct7013());
    expect(sf.channel).toBe("shopify");
    expect(sf.price).toBe(29.99);
    expect(sf.currency).toBe("GBP");
    expect(sf.priceStatus).toBe("configured");
    expect(sf.sourcePrice).toBe(95);
    expect(sf.sourceCurrency).toBe("CNY");
    expect(sf.readiness.shopify.status).toBe("READY");
    expect(sf.readiness.joybuy.status).toBe("READY");
  });

  it("keeps content READY when Shopify GBP missing but community price exists", () => {
    const sf = toStorefrontProduct(ct7013({ shopify_price: null, joybuy_price: null }));
    expect(sf.priceStatus).toBe("missing");
    expect(sf.price).toBeNull();
    expect(sf.readiness.status).toBe("READY");
    expect(sf.readiness.issues).not.toContain("MISSING_PRICE");
    expect(sf.readiness.shopify.status).toBe("NOT_READY");
    expect(sf.readiness.joybuy.status).toBe("NOT_READY");
  });
});

describe("Joybuy commercial payload", () => {
  it("uses joybuy_price GBP for CT7013", () => {
    const payload = buildJoybuyPricePayload(ct7013());
    expect(payload.price).toBe(29.99);
    expect(payload.currency).toBe("GBP");
  });

  it("supports divergent Joybuy 32.99", () => {
    const payload = buildJoybuyPricePayload(ct7013({ joybuy_price: 32.99 }));
    expect(payload.price).toBe(32.99);
    expect(payload.currency).toBe("GBP");
  });
});
