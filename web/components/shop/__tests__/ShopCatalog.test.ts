import { describe, expect, it } from "vitest";
import type { StorefrontProduct } from "@/lib/storefront";

/** Mirror of ShopCatalog filter logic for unit coverage. */
function filterShopProducts(
  products: Pick<StorefrontProduct, "brand" | "availabilityStatus">[],
  brand: string,
  availability: string,
) {
  return products.filter((p) => {
    if (brand !== "all" && (p.brand?.trim() ?? "") !== brand) return false;
    if (availability !== "all" && p.availabilityStatus !== availability) return false;
    return true;
  });
}

describe("shop discovery filters", () => {
  const sample = [
    { brand: "Mideer", availabilityStatus: "preorder" as const },
    { brand: "Micro Scooters", availabilityStatus: "in_stock" as const },
    { brand: "Mideer", availabilityStatus: "sold_out" as const },
  ];

  it("filters by brand without inventing taxonomy", () => {
    expect(filterShopProducts(sample, "Mideer", "all")).toHaveLength(2);
    expect(filterShopProducts(sample, "Micro Scooters", "all")).toHaveLength(1);
  });

  it("filters by StorefrontProduct availability states only", () => {
    expect(filterShopProducts(sample, "all", "preorder")).toHaveLength(1);
    expect(filterShopProducts(sample, "all", "in_stock")).toHaveLength(1);
    expect(filterShopProducts(sample, "Mideer", "sold_out")).toHaveLength(1);
  });

  it("returns empty when filters match nothing", () => {
    expect(filterShopProducts(sample, "Tonies", "all")).toHaveLength(0);
  });
});
