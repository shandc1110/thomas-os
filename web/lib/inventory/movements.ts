import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateMovementInput, MovementType } from "@/types/movement";
import type { InventoryBalance } from "@/types/inventory";

type BalanceBucket =
  | "available"
  | "allocated"
  | "reserved"
  | "incoming"
  | "damaged"
  | "returned"
  | "on_order";

function computeTotal(balance: Record<string, number>): number {
  return (
    balance.available +
    balance.damaged +
    balance.returned +
    balance.incoming +
    balance.allocated +
    balance.reserved +
    balance.on_order
  );
}

async function allocateMovementNumber(supabase: SupabaseClient): Promise<string> {
  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true });
  return `MOV-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function getOrCreateBalance(
  supabase: SupabaseClient,
  productId: string | number,
  warehouseId: string,
  locationId: string,
): Promise<{ id: string; available: number } | null> {
  const { data: existing } = await supabase
    .from("inventory_balances")
    .select("id, available")
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .single();

  if (existing) return { id: existing.id as string, available: existing.available as number };

  const { data: created, error } = await supabase
    .from("inventory_balances")
    .insert({
      product_id: productId,
      warehouse_id: warehouseId,
      location_id: locationId,
    })
    .select("id, available")
    .single();

  if (error || !created) return null;
  return { id: created.id as string, available: created.available as number };
}

/** Sync products.stock with sum of available across all locations (storefront compat). */
async function syncProductStock(
  supabase: SupabaseClient,
  productId: string | number,
): Promise<void> {
  const { data } = await supabase
    .from("inventory_balances")
    .select("available")
    .eq("product_id", productId);

  const total = (data ?? []).reduce((sum, row) => sum + ((row.available as number) ?? 0), 0);

  await supabase.from("products").update({ stock: total, updated_at: new Date().toISOString() }).eq("id", productId);
}

/**
 * Create an immutable stock movement and update inventory balances.
 * Inventory is NEVER edited directly — all changes go through this function.
 */
export async function createStockMovement(
  supabase: SupabaseClient,
  input: CreateMovementInput,
): Promise<{ movementId: string | null; error: string | null }> {
  const bucket: BalanceBucket = input.bucket ?? "available";
  const absQty = Math.abs(input.quantity);
  const isDecrease = input.quantity < 0;

  const { data: product } = await supabase
    .from("products")
    .select("sku")
    .eq("id", input.product_id)
    .single();

  const balance = await getOrCreateBalance(
    supabase,
    input.product_id,
    input.warehouse_id,
    input.location_id,
  );

  if (!balance) return { movementId: null, error: "Could not get inventory balance." };

  const { data: fullBalance } = await supabase
    .from("inventory_balances")
    .select("*")
    .eq("id", balance.id)
    .single();

  if (!fullBalance) return { movementId: null, error: "Balance record not found." };

  const currentBucketQty = (fullBalance[bucket] as number) ?? 0;

  if (isDecrease && currentBucketQty < absQty) {
    return {
      movementId: null,
      error: `Insufficient ${bucket} stock. Available: ${currentBucketQty}, requested: ${absQty}.`,
    };
  }

  const newBucketQty = isDecrease ? currentBucketQty - absQty : currentBucketQty + absQty;
  const newAvailable = bucket === "available" ? newBucketQty : (fullBalance.available as number);

  const movementNumber = await allocateMovementNumber(supabase);

  const { data: movement, error: movError } = await supabase
    .from("stock_movements")
    .insert({
      movement_number: movementNumber,
      movement_type: input.movement_type,
      product_id: input.product_id,
      sku: product?.sku ?? null,
      quantity: input.quantity,
      warehouse_id: input.warehouse_id,
      location_id: input.location_id,
      reference_type: input.reference_type ?? null,
      reference_id: input.reference_id ?? null,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      user_name: input.user_name ?? "system",
      balance_after: bucket === "available" ? newBucketQty : (fullBalance.available as number),
    })
    .select("id")
    .single();

  if (movError || !movement) {
    console.error("createStockMovement insert failed:", movError?.message);
    return { movementId: null, error: movError?.message ?? "Failed to record movement." };
  }

  const { error: balError } = await supabase
    .from("inventory_balances")
    .update({
      [bucket]: newBucketQty,
      last_updated: new Date().toISOString(),
    })
    .eq("id", balance.id);

  if (balError) {
    console.error("createStockMovement balance update failed:", balError.message);
    return { movementId: null, error: balError.message };
  }

  await syncProductStock(supabase, input.product_id);

  console.info(
    `[inventory] ${movementNumber} ${input.movement_type} SKU ${product?.sku} qty ${input.quantity} → ${bucket}=${newBucketQty}`,
  );

  return { movementId: movement.id as string, error: null };
}

/** Reserve stock for a customer order (decrease available). */
export async function recordCustomerOrderMovements(
  supabase: SupabaseClient,
  items: { product_id: string | number; quantity: number }[],
  orderId: string | number,
  orderNumber: string,
  warehouseId: string,
  locationId: string,
): Promise<{ error: string | null }> {
  for (const item of items) {
    const { error } = await createStockMovement(supabase, {
      movement_type: "customer_order",
      product_id: item.product_id,
      quantity: -item.quantity,
      warehouse_id: warehouseId,
      location_id: locationId,
      reference_type: "order",
      reference_id: String(orderNumber),
      reason: `Order ${orderNumber}`,
      notes: `Order ID ${orderId}`,
      bucket: "available",
    });
    if (error) return { error };
  }
  return { error: null };
}

/** Restore stock after a failed order (compensation). */
export async function restoreCustomerOrderMovements(
  supabase: SupabaseClient,
  items: { product_id: string | number; quantity: number }[],
  orderNumber: string,
  warehouseId: string,
  locationId: string,
): Promise<void> {
  for (const item of items) {
    await createStockMovement(supabase, {
      movement_type: "return",
      product_id: item.product_id,
      quantity: item.quantity,
      warehouse_id: warehouseId,
      location_id: locationId,
      reference_type: "order_rollback",
      reference_id: String(orderNumber),
      reason: `Order ${orderNumber} rollback`,
      bucket: "available",
    });
  }
}

export async function listMovements(
  supabase: SupabaseClient,
  options: { productId?: string | number; limit?: number } = {},
): Promise<{ movements: import("@/types/movement").StockMovement[]; error: string | null }> {
  let query = supabase
    .from("stock_movements")
    .select(`*, products ( name, sku ), warehouses ( code, name ), warehouse_locations ( code, name )`)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 50);

  if (options.productId) query = query.eq("product_id", options.productId);

  const { data, error } = await query;
  if (error) return { movements: [], error: error.message };

  const movements = (data ?? []).map((row) => ({
    id: row.id as string,
    movement_number: row.movement_number as string,
    movement_type: row.movement_type as MovementType,
    product_id: row.product_id as string | number,
    sku: row.sku as string | null,
    quantity: row.quantity as number,
    warehouse_id: row.warehouse_id as string | null,
    location_id: row.location_id as string | null,
    reference_type: row.reference_type as string | null,
    reference_id: row.reference_id as string | null,
    reason: row.reason as string | null,
    notes: row.notes as string | null,
    user_name: row.user_name as string | null,
    balance_after: row.balance_after as number | null,
    created_at: row.created_at as string,
    product: (row as { products?: { name: string; sku: string | null } }).products,
    warehouse: (row as { warehouses?: { code: string; name: string } }).warehouses,
    location: (row as { warehouse_locations?: { code: string; name: string } }).warehouse_locations,
  }));

  return { movements, error: null };
}

export async function getProductBalances(
  supabase: SupabaseClient,
  productId: string | number,
): Promise<{ balances: InventoryBalance[]; error: string | null }> {
  const { data, error } = await supabase
    .from("inventory_balances")
    .select(`*, warehouses ( code, name ), warehouse_locations ( code, name )`)
    .eq("product_id", productId);

  if (error) return { balances: [], error: error.message };

  const balances = (data ?? []).map((row) => {
    const available = (row.available as number) ?? 0;
    const allocated = (row.allocated as number) ?? 0;
    const reserved = (row.reserved as number) ?? 0;
    const incoming = (row.incoming as number) ?? 0;
    const damaged = (row.damaged as number) ?? 0;
    const returned = (row.returned as number) ?? 0;
    const on_order = (row.on_order as number) ?? 0;

    return {
      id: row.id as string,
      product_id: row.product_id as string | number,
      warehouse_id: row.warehouse_id as string,
      location_id: row.location_id as string,
      available,
      allocated,
      reserved,
      incoming,
      damaged,
      returned,
      on_order,
      total: available + allocated + reserved + incoming + damaged + returned + on_order,
      last_updated: row.last_updated as string,
      warehouse: (row as { warehouses?: { code: string; name: string } }).warehouses,
      location: (row as { warehouse_locations?: { code: string; name: string } }).warehouse_locations,
    };
  });

  return { balances, error: null };
}

export async function getProductLedger(
  supabase: SupabaseClient,
  productId: string | number,
): Promise<{ ledger: import("@/types/inventory").ProductLedgerEntry[]; error: string | null }> {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: true });

  if (error) return { ledger: [], error: error.message };

  const { MOVEMENT_TYPE_LABELS } = await import("@/types/movement");

  return {
    ledger: (data ?? []).map((row) => ({
      date: row.created_at as string,
      movement_number: row.movement_number as string,
      movement_type: row.movement_type as string,
      description: MOVEMENT_TYPE_LABELS[row.movement_type as MovementType] ?? row.movement_type,
      quantity: row.quantity as number,
      balance: (row.balance_after as number) ?? 0,
      reference: row.reference_id as string | null,
      notes: row.notes as string | null,
    })),
    error: null,
  };
}
