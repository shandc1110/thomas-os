import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { Product } from "@/lib/types";
import { mapProductToJoybuy } from "../products";
import { buildJoybuyInventoryPayload } from "../inventory";
import { buildJoybuyPricePayload } from "../pricing";
import {
  buildExternalProductMap,
  productMapKey,
  resolveProductSyncAction,
  upsertExternalProductRef,
} from "../mapping";
import { isJoybuyConfigured, getJoybuyConfigPresence } from "../config";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    sku: "SKU-001",
    name: "Test Toy",
    brand: "Mideer",
    category: "Puzzles",
    description: "A toy",
    barcode: "1234567890123",
    price: 99,
    retail_price: 120,
    shopify_price: 10,
    cost_price: 40,
    currency: "CNY",
    image_url: "https://cdn.example/a.jpg",
    gallery_images: ["https://cdn.example/b.jpg"],
    stock: 5,
    presell_enabled: false,
    presell_quantity: 0,
    expected_arrival_month: null,
    active: true,
    status: "active",
    assortment_status: null,
    weight_grams: 500,
    length_mm: 100,
    width_mm: 80,
    height_mm: 40,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

describe("Joybuy product mapping", () => {
  it("maps core product fields", () => {
    const mapped = mapProductToJoybuy(baseProduct());
    expect(mapped.sku).toBe("SKU-001");
    expect(mapped.title).toBe("Test Toy");
    expect(mapped.brand).toBe("Mideer");
    expect(mapped.category).toBe("Puzzles");
    expect(mapped.barcode).toBe("1234567890123");
    expect(mapped.price).toBe(99);
    expect(mapped.currency).toBe("CNY");
    expect(mapped.primaryImageUrl).toBe("https://cdn.example/a.jpg");
    expect(mapped.galleryImageUrls).toEqual(["https://cdn.example/b.jpg"]);
    expect(mapped.weightGrams).toBe(500);
    expect(mapped.dimensionsMm).toEqual({ length: 100, width: 80, height: 40 });
    expect(mapped.attributes).not.toHaveProperty("cost_price");
  });

  it("requires SKU", () => {
    expect(() => mapProductToJoybuy(baseProduct({ sku: "  " }))).toThrow(/SKU/i);
  });

  it("handles missing primary image via gallery fallback", () => {
    const mapped = mapProductToJoybuy(
      baseProduct({
        image_url: null,
        gallery_images: ["https://cdn.example/g1.jpg", "https://cdn.example/g2.jpg"],
      }),
    );
    expect(mapped.primaryImageUrl).toBe("https://cdn.example/g1.jpg");
    expect(mapped.galleryImageUrls).toHaveLength(2);
  });

  it("handles missing images entirely", () => {
    const mapped = mapProductToJoybuy(
      baseProduct({ image_url: null, gallery_images: [] }),
    );
    expect(mapped.primaryImageUrl).toBeNull();
    expect(mapped.galleryImageUrls).toEqual([]);
  });

  it("normalises empty gallery entries", () => {
    const mapped = mapProductToJoybuy(
      baseProduct({ gallery_images: ["", "  ", "https://cdn.example/ok.jpg"] as string[] }),
    );
    expect(mapped.galleryImageUrls).toEqual(["https://cdn.example/ok.jpg"]);
  });
});

describe("Joybuy inventory mapping", () => {
  it("uses sellable stock (on-hand)", () => {
    const payload = buildJoybuyInventoryPayload(baseProduct({ stock: 3, presell_enabled: false }));
    expect(payload.quantity).toBe(3);
    expect(payload.onHand).toBe(3);
    expect(payload.presell).toBe(0);
  });

  it("includes presell in sellable quantity", () => {
    const payload = buildJoybuyInventoryPayload(
      baseProduct({
        stock: 2,
        presell_enabled: true,
        presell_quantity: 10,
        expected_arrival_month: "2026-09",
      }),
    );
    expect(payload.quantity).toBe(12);
    expect(payload.onHand).toBe(2);
    expect(payload.presell).toBe(10);
    expect(payload.expectedArrivalMonth).toBe("2026-09");
  });

  it("maps out-of-stock products to zero", () => {
    const payload = buildJoybuyInventoryPayload(
      baseProduct({ stock: 0, presell_enabled: false, presell_quantity: 0 }),
    );
    expect(payload.quantity).toBe(0);
  });
});

describe("Joybuy price mapping", () => {
  it("maps sell price without cost", () => {
    const payload = buildJoybuyPricePayload(baseProduct({ price: 89.5, cost_price: 20 }));
    expect(payload.price).toBe(89.5);
    expect(payload.currency).toBe("CNY");
    expect(payload).not.toHaveProperty("cost_price");
  });

  it("nulls non-positive prices", () => {
    expect(buildJoybuyPricePayload(baseProduct({ price: 0 })).price).toBeNull();
    expect(buildJoybuyPricePayload(baseProduct({ price: null })).price).toBeNull();
  });
});

describe("Joybuy idempotency helpers", () => {
  it("builds stable map keys", () => {
    expect(productMapKey("org-1", "ABC")).toBe(productMapKey("org-1", "abc"));
  });

  it("resolves create vs update", () => {
    const map = buildExternalProductMap([
      {
        organizationId: "org-1",
        internalProductId: "p1",
        sku: "SKU-001",
        externalProductId: "jb-99",
        externalSkuId: "js-1",
      },
    ]);
    expect(resolveProductSyncAction(map, "org-1", "SKU-001")).toEqual({
      action: "update",
      externalProductId: "jb-99",
      externalSkuId: "js-1",
    });
    expect(resolveProductSyncAction(map, "org-1", "SKU-NEW")).toEqual({ action: "create" });
  });

  it("upserts refs without duplicating keys", () => {
    const map = buildExternalProductMap([]);
    upsertExternalProductRef(map, {
      organizationId: "org-1",
      internalProductId: "p1",
      sku: "SKU-001",
      externalProductId: "jb-1",
      externalSkuId: null,
    });
    upsertExternalProductRef(map, {
      organizationId: "org-1",
      internalProductId: "p1",
      sku: "SKU-001",
      externalProductId: "jb-2",
      externalSkuId: "x",
    });
    expect(map.size).toBe(1);
    expect(resolveProductSyncAction(map, "org-1", "SKU-001").action).toBe("update");
  });
});

describe("Joybuy configuration", () => {
  const keys = [
    "JOYBUY_APP_KEY",
    "JOYBUY_APP_SECRET",
    "JOYBUY_ACCESS_TOKEN",
    "JOYBUY_API_BASE_URL",
    "JOYBUY_CALLBACK_URL",
  ] as const;

  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (snapshot[key] === undefined) delete process.env[key];
      else process.env[key] = snapshot[key];
    }
  });

  it("reports missing configuration", () => {
    expect(isJoybuyConfigured()).toBe(false);
    const presence = getJoybuyConfigPresence();
    expect(presence.configured).toBe(false);
    expect(presence.appKey).toBe(false);
  });

  it("reports configured when all required env vars are set", () => {
    process.env.JOYBUY_APP_KEY = "key";
    process.env.JOYBUY_APP_SECRET = "secret";
    process.env.JOYBUY_ACCESS_TOKEN = "token";
    process.env.JOYBUY_API_BASE_URL = "https://example.invalid";
    expect(isJoybuyConfigured()).toBe(true);
    expect(getJoybuyConfigPresence().configured).toBe(true);
  });
});
