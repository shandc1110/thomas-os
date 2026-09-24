import type { Brand } from "@/types/supplier";
import { BRAND_REGISTRY } from "./registry";
import { brandSlugFromProductBrand, normaliseBrandLabel } from "./match";
import type { BrandConfig } from "./types";

export function isContractStatusActive(status: string | null | undefined): boolean {
  return normaliseBrandLabel(status) === "active";
}

/**
 * Match a purchasing DB brand name to a storefront registry slug.
 */
export function registrySlugFromDbBrandName(name: string | null | undefined): string | null {
  const label = normaliseBrandLabel(name);
  if (!label) return null;

  for (const brand of BRAND_REGISTRY) {
    if (normaliseBrandLabel(brand.name) === label) return brand.slug;
  }

  return brandSlugFromProductBrand(name);
}

/**
 * Apply DB contract_status onto registry configs.
 * When a matching DB row exists, contract_status === 'active' wins.
 * When no DB row, keep registry.active.
 */
export function applyDbContractStatusToRegistry(
  registry: BrandConfig[],
  dbBrands: Pick<Brand, "name" | "contract_status">[],
): BrandConfig[] {
  const statusBySlug = new Map<string, boolean>();

  for (const row of dbBrands) {
    const slug = registrySlugFromDbBrandName(row.name);
    if (!slug) continue;
    statusBySlug.set(slug, isContractStatusActive(row.contract_status));
  }

  return registry.map((brand) => {
    if (!statusBySlug.has(brand.slug)) return brand;
    return { ...brand, active: statusBySlug.get(brand.slug)! };
  });
}
