import { describe, expect, it } from "vitest";
import {
  buildProductSlug,
  extractProductIdFromSlug,
  productUrl,
  slugifySegment,
} from "@/lib/products/slug";
import type { Product } from "@/lib/types";

const sampleProduct: Pick<Product, "id" | "name" | "brand"> = {
  id: "1617d475-bdde-4bef-b59b-e3f4c3cd0a19",
  name: "Tonies Toniebox 3",
  brand: "Tonies",
};

describe("slugifySegment", () => {
  it("normalises text to URL-safe segments", () => {
    expect(slugifySegment("Micro Mini Micro Scooter")).toBe("micro-mini-micro-scooter");
    expect(slugifySegment("  Hello World!  ")).toBe("hello-world");
  });
});

describe("buildProductSlug", () => {
  it("builds brand-name-id slug", () => {
    const slug = buildProductSlug(sampleProduct);
    expect(slug).toBe(
      "tonies-tonies-toniebox-3-1617d475-bdde-4bef-b59b-e3f4c3cd0a19",
    );
  });

  it("uses stable id suffix for collision safety", () => {
    const a = buildProductSlug({
      id: "1617d475-bdde-4bef-b59b-e3f4c3cd0a19",
      name: "Same Name",
      brand: "Tonies",
    });
    const b = buildProductSlug({
      id: "b0468ed1-5a9a-4dbc-bb6c-e3786120d5e4",
      name: "Same Name",
      brand: "Tonies",
    });
    expect(a).not.toBe(b);
  });
});

describe("extractProductIdFromSlug", () => {
  it("extracts UUID from slug tail", () => {
    const slug = buildProductSlug(sampleProduct);
    expect(extractProductIdFromSlug(slug)).toBe(sampleProduct.id);
  });

  it("extracts numeric legacy id", () => {
    expect(extractProductIdFromSlug("mideer-sticker-42")).toBe("42");
  });

  it("returns null for invalid slug", () => {
    expect(extractProductIdFromSlug("no-id-here")).toBeNull();
  });
});

describe("productUrl", () => {
  it("returns canonical /products path", () => {
    expect(productUrl(sampleProduct)).toBe(`/products/${buildProductSlug(sampleProduct)}`);
  });
});
