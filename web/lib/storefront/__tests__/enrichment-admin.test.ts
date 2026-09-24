import { describe, expect, it } from "vitest";
import {
  normalizeEnrichmentText,
  proposeChloeEditCandidates,
  storefrontProductToEnrichmentRow,
  updateActiveProductEnrichment,
} from "@/lib/storefront/enrichment-admin";
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
    gallery_images: ["https://example.com/g2.jpg"],
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

describe("active enrichment row", () => {
  it("maps CT7013 gaps without inventing copy", () => {
    const row = storefrontProductToEnrichmentRow(toStorefrontProduct(baseProduct()));
    expect(row.sku).toBe("CT7013");
    expect(row.hasImage).toBe(true);
    expect(row.hasBrand).toBe(true);
    expect(row.hasDescription).toBe(false);
    expect(row.hasCategory).toBe(false);
    expect(row.galleryImageCount).toBe(1);
    expect(row.enrichmentComplete).toBe(false);
    expect(row.issues).toContain("MISSING_DESCRIPTION");
    expect(row.issues).toContain("MISSING_CATEGORY");
    expect(row.description).toBeNull();
  });

  it("marks complete only when description, category, brand, and image exist", () => {
    const incomplete = storefrontProductToEnrichmentRow(toStorefrontProduct(baseProduct()));
    expect(incomplete.enrichmentComplete).toBe(false);

    const complete = storefrontProductToEnrichmentRow(
      toStorefrontProduct(
        baseProduct({
          description: "A magnetic anatomy board for curious children.",
          category: "Toys",
        }),
      ),
    );
    expect(complete.enrichmentComplete).toBe(true);
    expect(complete.hasDescription).toBe(true);
    expect(complete.hasCategory).toBe(true);
  });

  it("ignores blank description strings", () => {
    const row = storefrontProductToEnrichmentRow(
      toStorefrontProduct(baseProduct({ description: "   " })),
    );
    expect(row.hasDescription).toBe(false);
    expect(row.description).toBeNull();
  });
});

describe("Chloe Edit candidates", () => {
  it("ranks products with richer existing data first for human review", () => {
    const rich = storefrontProductToEnrichmentRow(
      toStorefrontProduct(
        baseProduct({
          id: "a",
          sku: "RICH",
          name: "Rich Product",
          description: "Has copy",
          category: "Toys",
          gallery_images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
        }),
      ),
    );
    const thin = storefrontProductToEnrichmentRow(
      toStorefrontProduct(
        baseProduct({
          id: "b",
          sku: "THIN",
          name: "Thin Product",
          image_url: "https://example.com/thin.jpg",
          gallery_images: [],
        }),
      ),
    );
    const candidates = proposeChloeEditCandidates([thin, rich], 2);
    expect(candidates[0]?.sku).toBe("RICH");
    expect(candidates).toHaveLength(2);
  });

  it("excludes products without an image from candidates", () => {
    const noImage = storefrontProductToEnrichmentRow(
      toStorefrontProduct(baseProduct({ image_url: null, gallery_images: [] })),
    );
    expect(proposeChloeEditCandidates([noImage], 5)).toHaveLength(0);
  });
});

describe("normalizeEnrichmentText", () => {
  it("trims and nulls blank strings", () => {
    expect(normalizeEnrichmentText("  Toys  ")).toBe("Toys");
    expect(normalizeEnrichmentText("   ")).toBeNull();
    expect(normalizeEnrichmentText(null)).toBeNull();
    expect(normalizeEnrichmentText(12)).toBeNull();
  });
});

function productRow(overrides: Record<string, unknown> = {}) {
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
    organization_id: "00000000-0000-0000-0000-000000000001",
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

type MockState = {
  existing: Record<string, unknown> | null;
  lastUpdate: Record<string, unknown> | null;
};

function mockSupabase(state: MockState) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                eq(_col2: string, _val2: unknown) {
                  return {
                    maybeSingle: async () => ({ data: state.existing, error: null }),
                  };
                },
                maybeSingle: async () => ({ data: state.existing, error: null }),
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          state.lastUpdate = payload;
          return {
            eq(_col: string, _val: unknown) {
              return {
                eq(_col2: string, _val2: unknown) {
                  return {
                    eq(_col3: string, _val3: unknown) {
                      return {
                        select(_c: string) {
                          return {
                            maybeSingle: async () => {
                              if (!state.existing) return { data: null, error: null };
                              if (state.existing.assortment_status !== "active") {
                                return { data: null, error: null };
                              }
                              const next = { ...state.existing, ...payload };
                              state.existing = next;
                              return { data: next, error: null };
                            },
                          };
                        },
                      };
                    },
                    select(_c: string) {
                      return {
                        maybeSingle: async () => {
                          if (!state.existing) return { data: null, error: null };
                          const next = { ...state.existing, ...payload };
                          state.existing = next;
                          return { data: next, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("updateActiveProductEnrichment", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";

  it("updates category and description for CT7013 and refreshes readiness issues", async () => {
    const state: MockState = { existing: productRow(), lastUpdate: null };
    const sb = mockSupabase(state) as never;

    const result = await updateActiveProductEnrichment(sb, {
      productId: CT7013_ID,
      organizationId: orgId,
      category: "  Learning toys  ",
      description: "  A magnetic anatomy board for curious children.  ",
    });

    expect(result.error).toBeNull();
    expect(result.status).toBe(200);
    expect(result.updatedFields).toEqual(["category", "description", "updated_at"]);
    expect(state.lastUpdate).toMatchObject({
      category: "Learning toys",
      description: "A magnetic anatomy board for curious children.",
    });
    expect(state.lastUpdate).not.toHaveProperty("price");
    expect(state.lastUpdate).not.toHaveProperty("sku");
    expect(state.lastUpdate).not.toHaveProperty("assortment_status");
    expect(state.lastUpdate).not.toHaveProperty("brand");
    expect(state.lastUpdate).not.toHaveProperty("stock");

    expect(result.storefront?.category).toBe("Learning toys");
    expect(result.storefront?.description).toBe(
      "A magnetic anatomy board for curious children.",
    );
    expect(result.storefront?.readiness.issues).not.toContain("MISSING_CATEGORY");
    expect(result.storefront?.readiness.issues).not.toContain("MISSING_DESCRIPTION");
    expect(result.row?.enrichmentComplete).toBe(true);
  });

  it("rejects non-active assortment products", async () => {
    const state: MockState = {
      existing: productRow({ assortment_status: "paused" }),
      lastUpdate: null,
    };
    const result = await updateActiveProductEnrichment(mockSupabase(state) as never, {
      productId: CT7013_ID,
      organizationId: orgId,
      category: "Toys",
      description: "Nope",
    });
    expect(result.status).toBe(403);
    expect(result.error).toMatch(/assortment-active/i);
    expect(state.lastUpdate).toBeNull();
  });

  it("allows clearing fields to null via blank strings", async () => {
    const state: MockState = {
      existing: productRow({ category: "Toys", description: "Old copy" }),
      lastUpdate: null,
    };
    const result = await updateActiveProductEnrichment(mockSupabase(state) as never, {
      productId: CT7013_ID,
      organizationId: orgId,
      category: "   ",
      description: "",
    });
    expect(result.error).toBeNull();
    expect(state.lastUpdate).toMatchObject({ category: null, description: null });
    expect(result.row?.hasCategory).toBe(false);
    expect(result.row?.hasDescription).toBe(false);
    expect(result.storefront?.readiness.issues).toContain("MISSING_CATEGORY");
    expect(result.storefront?.readiness.issues).toContain("MISSING_DESCRIPTION");
  });
});
