import { describe, expect, it } from "vitest";
import { projectChloeEditFeedFromRows } from "@/lib/storefront/chloe-edit-project";
import { toStorefrontProduct } from "@/lib/storefront/map";
import type { Product } from "@/lib/types";

const ORG = "org-chosen-by-chloe";

function productRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "3fe3be28-7bf2-4715-9155-bc1bb0ece79b",
    organization_id: ORG,
    sku: "CT7013",
    name: "mideer BODY MAGNET",
    brand: "Mideer",
    category: null,
    description: null,
    barcode: null,
    price: 95,
    retail_price: 95,
    shopify_price: 29.99,
    joybuy_price: 32.99,
    cost_price: null,
    currency: "CNY",
    image_url: "https://example.com/CT7013.jpg",
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

describe("Chloe Edit feed projection", () => {
  it("orders by position ASC then productId", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "c2",
          position: 30,
          editorial_note: null,
          product: productRow({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", sku: "B" }),
        },
        {
          id: "c1",
          position: 10,
          editorial_note: null,
          product: productRow({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", sku: "A" }),
        },
        {
          id: "c3",
          position: 10,
          editorial_note: null,
          product: productRow({ id: "cccccccc-cccc-cccc-cccc-cccccccccccc", sku: "C" }),
        },
      ],
      ORG,
    );
    expect(feed.map((f) => f.product.sku)).toEqual(["A", "C", "B"]);
    expect(feed.map((f) => f.position)).toEqual([10, 10, 30]);
  });

  it("excludes paused and retired from customer feed but would keep curation rows separately", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "active",
          position: 10,
          editorial_note: null,
          product: productRow({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
        },
        {
          id: "paused",
          position: 20,
          editorial_note: null,
          product: productRow({
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            assortment_status: "paused",
          }),
        },
        {
          id: "retired",
          position: 30,
          editorial_note: null,
          product: productRow({
            id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            assortment_status: "retired",
          }),
        },
      ],
      ORG,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]?.curationId).toBe("active");
  });

  it("returns reactivated products using existing position", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "cur-1",
          position: 40,
          editorial_note: null,
          product: productRow({
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            assortment_status: "active",
          }),
        },
      ],
      ORG,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]?.position).toBe(40);
  });

  it("keeps nullable editorial notes and trims blanks", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "n1",
          position: 10,
          editorial_note: "  Loved this  ",
          product: productRow({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
        },
        {
          id: "n2",
          position: 20,
          editorial_note: "   ",
          product: productRow({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }),
        },
      ],
      ORG,
    );
    expect(feed[0]?.editorialNote).toBe("Loved this");
    expect(feed[1]?.editorialNote).toBeNull();
  });

  it("scopes out other organizations", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "x",
          position: 10,
          editorial_note: null,
          product: productRow({ organization_id: "other-org" }),
        },
      ],
      ORG,
    );
    expect(feed).toHaveLength(0);
  });

  it("respects homepage limit", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "1",
          position: 10,
          editorial_note: null,
          product: productRow({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }),
        },
        {
          id: "2",
          position: 20,
          editorial_note: null,
          product: productRow({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }),
        },
        {
          id: "3",
          position: 30,
          editorial_note: null,
          product: productRow({ id: "cccccccc-cccc-cccc-cccc-cccccccccccc" }),
        },
      ],
      ORG,
      2,
    );
    expect(feed).toHaveLength(2);
  });

  it("projects Shopify GBP — never Joybuy or community CNY", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "ct",
          position: 10,
          editorial_note: null,
          product: productRow({
            price: 95,
            currency: "CNY",
            shopify_price: 29.99,
            joybuy_price: 32.99,
          }),
        },
      ],
      ORG,
    );
    const product = feed[0]!.product;
    expect(product.price).toBe(29.99);
    expect(product.currency).toBe("GBP");
    expect(product.sourcePrice).toBe(95);
    expect(product.sourceCurrency).toBe("CNY");
    expect(product.price).not.toBe(32.99);
    expect(product.price).not.toBe(95);
  });

  it("marks missing Shopify price as not configured (no CNY fallback)", () => {
    const feed = projectChloeEditFeedFromRows(
      [
        {
          id: "ct",
          position: 10,
          editorial_note: null,
          product: productRow({ shopify_price: null, price: 95, currency: "CNY" }),
        },
      ],
      ORG,
    );
    expect(feed[0]?.product.priceStatus).toBe("missing");
    expect(feed[0]?.product.price).toBeNull();
  });

  it("uses StorefrontProduct projection (no duplicated product model)", () => {
    const row = productRow();
    const feed = projectChloeEditFeedFromRows(
      [{ id: "c", position: 10, editorial_note: null, product: row }],
      ORG,
    );
    const direct = toStorefrontProduct(row as unknown as Product);
    expect(feed[0]?.product.productId).toBe(direct.productId);
    expect(feed[0]?.product.slug).toBe(direct.slug);
    expect(feed[0]?.product.channel).toBe("shopify");
  });
});
