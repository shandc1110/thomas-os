import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";
import type { Brand } from "@/types/supplier";
import { BRAND_REGISTRY } from "./registry";
import { normaliseBrandLabel } from "./match";
import {
  applyDbContractStatusToRegistry,
  isContractStatusActive,
  registrySlugFromDbBrandName,
} from "./storefront-active-core";
import type { BrandConfig } from "./types";

export {
  applyDbContractStatusToRegistry,
  isContractStatusActive,
  registrySlugFromDbBrandName,
} from "./storefront-active-core";

async function loadDbBrands(): Promise<Pick<Brand, "name" | "contract_status">[]> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("brands")
    .select("name, contract_status")
    .eq("organization_id", tenant.organizationId);

  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Brand, "name" | "contract_status">[];
}

/** Registry brands with live console contract_status applied when a DB row matches. */
export async function resolveStorefrontBrands(): Promise<BrandConfig[]> {
  try {
    const dbBrands = await loadDbBrands();
    return applyDbContractStatusToRegistry(BRAND_REGISTRY, dbBrands);
  } catch {
    // Fail open to registry defaults if purchasing brands cannot be loaded.
    return BRAND_REGISTRY.map((b) => ({ ...b }));
  }
}

export async function getStorefrontActiveBrands(): Promise<BrandConfig[]> {
  const brands = await resolveStorefrontBrands();
  return brands.filter((b) => b.active);
}

export async function resolveStorefrontBrandBySlug(
  slug: string,
): Promise<BrandConfig | null> {
  const key = slug.trim().toLowerCase();
  const brands = await resolveStorefrontBrands();
  return brands.find((b) => b.slug === key) ?? null;
}

export async function isStorefrontBrandActive(slug: string): Promise<boolean> {
  const brand = await resolveStorefrontBrandBySlug(slug);
  return Boolean(brand?.active);
}

/**
 * Ensure every storefront registry brand has a purchasing brands row.
 * Inserts missing names only — does not overwrite existing contract_status.
 */
export async function seedStorefrontBrandsFromRegistry(): Promise<{
  inserted: number;
  skipped: number;
  error: string | null;
}> {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const { data: existing, error: listError } = await supabase
    .from("brands")
    .select("name")
    .eq("organization_id", tenant.organizationId);

  if (listError) return { inserted: 0, skipped: 0, error: listError.message };

  const existingNames = new Set(
    (existing ?? []).map((row) => normaliseBrandLabel(String(row.name ?? ""))),
  );

  let inserted = 0;
  let skipped = 0;

  for (const brand of BRAND_REGISTRY) {
    const key = normaliseBrandLabel(brand.name);
    if (existingNames.has(key)) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("brands").insert({
      name: brand.name,
      contract_status: brand.active ? "active" : "inactive",
      organization_id: tenant.organizationId,
      logo_url: brand.logoUrl ?? null,
    });

    if (error) {
      if (error.code === "23505") {
        skipped++;
        continue;
      }
      return { inserted, skipped, error: error.message };
    }

    inserted++;
    existingNames.add(key);
  }

  return { inserted, skipped, error: null };
}
