import { describe, expect, it } from "vitest";
import { PRODUCT_IMAGE_CONTAIN_CLASS } from "@/components/products/ProductImage";

describe("PRODUCT_IMAGE_CONTAIN_CLASS", () => {
  it("uses contain, not cover, so product photos are not cropped", () => {
    expect(PRODUCT_IMAGE_CONTAIN_CLASS).toContain("object-contain");
    expect(PRODUCT_IMAGE_CONTAIN_CLASS).not.toContain("object-cover");
  });
});
