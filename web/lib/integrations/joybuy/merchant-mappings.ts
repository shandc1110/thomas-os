import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  CT7013_BRAND_NAME,
  CT7013_SKU,
  getJoybuyMerchantConfigFromEnv,
  JOYBUY_CHANNEL,
  type CatalogMappingRow,
  type JoybuyMerchantConfig,
} from "./merchant-config";

/** Upsert only the CT7013 / Mideer merchant mappings when env values are present. */
export async function upsertJoybuyMerchantMappingsFromEnv(
  supabase: SupabaseClient,
  config: JoybuyMerchantConfig = getJoybuyMerchantConfigFromEnv(),
): Promise<{ upserted: CatalogMappingRow[]; skipped: string[] }> {
  const organizationId = getOrganizationId();
  const upserted: CatalogMappingRow[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();

  const candidates: CatalogMappingRow[] = [];
  if (config.mideerBrandId) {
    candidates.push({
      entity_type: "brand",
      internal_key: CT7013_BRAND_NAME,
      external_id: config.mideerBrandId,
      label: "Mideer (Joybuy brand)",
    });
  } else {
    skipped.push("brand:Mideer");
  }
  if (config.ct7013CategoryId) {
    candidates.push({
      entity_type: "category",
      internal_key: CT7013_SKU,
      external_id: config.ct7013CategoryId,
      label: "Body Magnet / CT7013 category (merchant-selected)",
    });
  } else {
    skipped.push("category:CT7013");
  }
  if (config.shopId) {
    candidates.push({
      entity_type: "shop",
      internal_key: "default",
      external_id: config.shopId,
      label: "Joybuy shop",
    });
  } else {
    skipped.push("shop:default");
  }
  if (config.scene) {
    candidates.push({
      entity_type: "scene",
      internal_key: "default",
      external_id: config.scene,
      label: "Joybuy scene",
    });
  } else {
    skipped.push("scene:default");
  }

  for (const row of candidates) {
    const { error } = await supabase.from("channel_catalog_mappings").upsert(
      {
        organization_id: organizationId,
        channel: JOYBUY_CHANNEL,
        entity_type: row.entity_type,
        internal_key: row.internal_key,
        external_id: row.external_id,
        label: row.label,
        updated_at: now,
      },
      { onConflict: "organization_id,channel,entity_type,internal_key" },
    );
    if (error) {
      throw new Error(`Failed to upsert ${row.entity_type}:${row.internal_key}: ${error.message}`);
    }
    upserted.push(row);
  }

  return { upserted, skipped };
}

export async function loadJoybuyCatalogExternalId(
  supabase: SupabaseClient,
  entityType: CatalogMappingRow["entity_type"],
  internalKey: string,
): Promise<string | null> {
  const organizationId = getOrganizationId();
  const { data, error } = await supabase
    .from("channel_catalog_mappings")
    .select("external_id")
    .eq("organization_id", organizationId)
    .eq("channel", JOYBUY_CHANNEL)
    .eq("entity_type", entityType)
    .eq("internal_key", internalKey)
    .maybeSingle();
  if (error) return null;
  return (data?.external_id as string | undefined) ?? null;
}
