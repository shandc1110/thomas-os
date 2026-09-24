import { describe, expect, it } from "vitest";
import type { BrandConfig } from "@/lib/brands/types";
import {
  applyDbContractStatusToRegistry,
  isContractStatusActive,
  registrySlugFromDbBrandName,
} from "@/lib/brands/storefront-active-core";

const registry: BrandConfig[] = [
  {
    slug: "mideer",
    name: "Mideer",
    matchNames: ["mideer", "mi deer"],
    tagline: "t",
    description: "d",
    heroAccent: "#000",
    metaTitle: "m",
    metaDescription: "m",
    active: true,
    defaultCurrency: "CNY",
  },
  {
    slug: "connetix",
    name: "Connetix",
    matchNames: ["connetix"],
    tagline: "t",
    description: "d",
    heroAccent: "#000",
    metaTitle: "m",
    metaDescription: "m",
    active: false,
    defaultCurrency: "GBP",
  },
  {
    slug: "grass-and-air",
    name: "Grass & Air",
    matchNames: ["grass & air", "grass and air"],
    tagline: "t",
    description: "d",
    heroAccent: "#000",
    metaTitle: "m",
    metaDescription: "m",
    active: true,
    defaultCurrency: "GBP",
  },
];

describe("storefront brand contract_status", () => {
  it("treats only 'active' as active (case-insensitive)", () => {
    expect(isContractStatusActive("active")).toBe(true);
    expect(isContractStatusActive("Active")).toBe(true);
    expect(isContractStatusActive("inactive")).toBe(false);
    expect(isContractStatusActive("paused")).toBe(false);
    expect(isContractStatusActive(null)).toBe(false);
  });

  it("matches DB names to registry slugs", () => {
    expect(registrySlugFromDbBrandName("Mideer")).toBe("mideer");
    expect(registrySlugFromDbBrandName("Grass and Air")).toBe("grass-and-air");
    expect(registrySlugFromDbBrandName("Unknown Brand")).toBeNull();
  });

  it("overrides registry.active when a matching DB row exists", () => {
    const resolved = applyDbContractStatusToRegistry(registry, [
      { name: "Mideer", contract_status: "inactive" },
      { name: "Connetix", contract_status: "active" },
    ]);
    expect(resolved.find((b) => b.slug === "mideer")?.active).toBe(false);
    expect(resolved.find((b) => b.slug === "connetix")?.active).toBe(true);
    // No DB row → keep registry
    expect(resolved.find((b) => b.slug === "grass-and-air")?.active).toBe(true);
  });
});
