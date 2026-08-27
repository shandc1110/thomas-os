import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/types";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { getJoybuyClient } from "./client";
import { toJoybuyFailure } from "./errors";
import { buildJoybuyInventoryPayload } from "./inventory";
import { joybuyLog } from "./log";
import {
  buildExternalProductMap,
  resolveProductSyncAction,
  upsertExternalProductRef,
} from "./mapping";
import { buildJoybuyPricePayload } from "./pricing";
import { buildJoybuyProductPayload } from "./products";
import { buildJoybuyShipmentPayload } from "./fulfilment";
import type { JoybuyExternalProductRef, JoybuyResult } from "./types";

async function loadProducts(
  supabase: SupabaseClient,
  productIds?: string[],
): Promise<Product[]> {
  const organizationId = getOrganizationId();
  let query = supabase
    .from("products")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("active", true);

  if (productIds?.length) {
    query = query.in("id", productIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Product[];
}

async function loadExternalRefs(
  supabase: SupabaseClient,
): Promise<JoybuyExternalProductRef[]> {
  const organizationId = getOrganizationId();
  const { data, error } = await supabase
    .from("channel_product_mappings")
    .select(
      "organization_id, internal_product_id, sku, external_product_id, external_sku_id",
    )
    .eq("organization_id", organizationId)
    .eq("channel", "joybuy");

  if (error) {
    // Table may not exist until migration is applied — treat as empty map.
    joybuyLog({
      operation: "loadExternalRefs",
      level: "warn",
      errorCode: error.code,
      message: "channel_product_mappings unavailable; treating as empty",
      organizationId,
    });
    return [];
  }

  return (data ?? []).map((row) => ({
    organizationId: row.organization_id as string,
    internalProductId: String(row.internal_product_id),
    sku: String(row.sku ?? ""),
    externalProductId: (row.external_product_id as string | null) ?? null,
    externalSkuId: (row.external_sku_id as string | null) ?? null,
  }));
}

export async function syncProductToJoybuy(
  supabase: SupabaseClient,
  productId: string,
): Promise<JoybuyResult<{ sku: string; action: "create" | "update" }>> {
  try {
    const products = await loadProducts(supabase, [productId]);
    const product = products[0];
    if (!product) {
      return {
        success: false,
        code: "JOYBUY_MAPPING_ERROR",
        message: "Product not found for this organization.",
      };
    }

    const organizationId = getOrganizationId();
    const payload = buildJoybuyProductPayload(product);
    const refs = await loadExternalRefs(supabase);
    const map = buildExternalProductMap(refs);
    const decision = resolveProductSyncAction(map, organizationId, payload.sku);
    const client = getJoybuyClient();

    joybuyLog({
      operation: "syncProductToJoybuy",
      sku: payload.sku,
      internalProductId: payload.internalProductId,
      organizationId,
      message: `planned ${decision.action}`,
    });

    if (decision.action === "update") {
      await client.updateProduct(decision.externalProductId, payload);
    } else {
      await client.createProduct(payload);
    }

    // Unreachable until API is implemented — client throws first.
    return {
      success: true,
      data: { sku: payload.sku, action: decision.action },
    };
  } catch (error) {
    const failure = toJoybuyFailure(error);
    joybuyLog({
      operation: "syncProductToJoybuy",
      level: "warn",
      errorCode: failure.code,
      message: failure.message,
      internalProductId: productId,
      organizationId: getOrganizationId(),
    });
    return failure;
  }
}

export async function syncProductsToJoybuy(
  supabase: SupabaseClient,
  productIds?: string[],
): Promise<JoybuyResult<{ attempted: number }>> {
  try {
    const products = await loadProducts(supabase, productIds);
    const organizationId = getOrganizationId();
    const refs = await loadExternalRefs(supabase);
    const map = buildExternalProductMap(refs);
    const client = getJoybuyClient();

    for (const product of products) {
      const payload = buildJoybuyProductPayload(product);
      const decision = resolveProductSyncAction(map, organizationId, payload.sku);
      if (decision.action === "update") {
        await client.updateProduct(decision.externalProductId, payload);
      } else {
        const created = await client.createProduct(payload);
        upsertExternalProductRef(map, {
          organizationId,
          internalProductId: payload.internalProductId,
          sku: payload.sku,
          externalProductId: created.externalProductId,
          externalSkuId: null,
        });
      }
    }

    return { success: true, data: { attempted: products.length } };
  } catch (error) {
    return toJoybuyFailure(error);
  }
}

export async function syncInventoryToJoybuy(
  supabase: SupabaseClient,
  productIds?: string[],
): Promise<JoybuyResult<{ attempted: number }>> {
  try {
    const products = await loadProducts(supabase, productIds);
    const client = getJoybuyClient();
    for (const product of products) {
      const payload = buildJoybuyInventoryPayload(product);
      await client.updateInventory(payload);
    }
    return { success: true, data: { attempted: products.length } };
  } catch (error) {
    return toJoybuyFailure(error);
  }
}

export async function syncPriceToJoybuy(
  supabase: SupabaseClient,
  productIds?: string[],
): Promise<JoybuyResult<{ attempted: number }>> {
  try {
    const products = await loadProducts(supabase, productIds);
    const client = getJoybuyClient();
    for (const product of products) {
      const payload = buildJoybuyPricePayload(product);
      await client.updatePrice(payload);
    }
    return { success: true, data: { attempted: products.length } };
  } catch (error) {
    return toJoybuyFailure(error);
  }
}

export async function importJoybuyOrders(): Promise<
  JoybuyResult<{ imported: number }>
> {
  try {
    const client = getJoybuyClient();
    const orders = await client.listOrders();
    // Import into Thomas orders will be wired after official order schema is confirmed.
    void orders;
    return { success: true, data: { imported: 0 } };
  } catch (error) {
    return toJoybuyFailure(error);
  }
}

export async function syncJoybuyOrderStatus(
  externalOrderId: string,
  status: string,
): Promise<JoybuyResult> {
  try {
    const client = getJoybuyClient();
    await client.updateOrderStatus(externalOrderId, status);
    return { success: true, data: undefined };
  } catch (error) {
    return toJoybuyFailure(error);
  }
}

export async function syncJoybuyShipment(input: {
  externalOrderId: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
  lineSkus?: string[];
}): Promise<JoybuyResult> {
  try {
    const shipment = buildJoybuyShipmentPayload(input);
    const client = getJoybuyClient();
    await client.submitShipment(shipment);
    return { success: true, data: undefined };
  } catch (error) {
    return toJoybuyFailure(error);
  }
}
