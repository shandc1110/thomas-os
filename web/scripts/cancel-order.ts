/**
 * Cancel an order by order number and restore stock / pre-sell allocations.
 *
 * Usage (from web/):
 *   npx tsx scripts/cancel-order.ts CBC9107
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

async function getDefaultWarehouseLocation(supabase: SupabaseClient) {
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id")
    .eq("is_default", true)
    .eq("active", true)
    .limit(1)
    .single();
  if (!warehouse) return null;

  const { data: location } = await supabase
    .from("warehouse_locations")
    .select("id")
    .eq("warehouse_id", warehouse.id)
    .eq("active", true)
    .limit(1)
    .single();
  if (!location) return null;

  return { warehouseId: warehouse.id as string, locationId: location.id as string };
}

async function restoreOnHand(
  supabase: SupabaseClient,
  productId: string,
  quantity: number,
  orderNumber: string,
  warehouseId: string,
  locationId: string,
) {
  const { data: product } = await supabase.from("products").select("sku").eq("id", productId).single();

  const { data: balance } = await supabase
    .from("inventory_balances")
    .select("id, available")
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .maybeSingle();

  const currentAvailable = (balance?.available as number) ?? 0;
  const newAvailable = currentAvailable + quantity;

  const { count } = await supabase.from("stock_movements").select("id", { count: "exact", head: true });
  const movementNumber = `MOV-${String((count ?? 0) + 1).padStart(6, "0")}`;

  const { error: movError } = await supabase.from("stock_movements").insert({
    movement_number: movementNumber,
    movement_type: "return",
    product_id: productId,
    sku: product?.sku ?? null,
    quantity,
    warehouse_id: warehouseId,
    location_id: locationId,
    reference_type: "order_cancel",
    reference_id: orderNumber,
    reason: `Order ${orderNumber} cancelled`,
    user_name: "system",
    balance_after: newAvailable,
  });
  if (movError) throw movError;

  if (balance?.id) {
    await supabase
      .from("inventory_balances")
      .update({ available: newAvailable, last_updated: new Date().toISOString() })
      .eq("id", balance.id);
  } else {
    await supabase.from("inventory_balances").insert({
      product_id: productId,
      warehouse_id: warehouseId,
      location_id: locationId,
      available: newAvailable,
    });
  }

  const { data: allBalances } = await supabase
    .from("inventory_balances")
    .select("available")
    .eq("product_id", productId);
  const stockTotal = (allBalances ?? []).reduce((sum, row) => sum + ((row.available as number) ?? 0), 0);
  await supabase.from("products").update({ stock: stockTotal }).eq("id", productId);

  console.log(`  restored ${quantity} on-hand for ${product?.sku ?? productId}`);
}

async function restorePresell(
  supabase: SupabaseClient,
  productId: string,
  quantity: number,
) {
  const { data: product } = await supabase
    .from("products")
    .select("presell_quantity, sku")
    .eq("id", productId)
    .single();

  const current = (product?.presell_quantity as number) ?? 0;
  await supabase
    .from("products")
    .update({ presell_quantity: current + quantity })
    .eq("id", productId);

  console.log(`  restored ${quantity} pre-sell for ${product?.sku ?? productId}`);
}

async function main() {
  const orderNumberArg = process.argv[2];
  const skipPresell = process.argv.includes("--skip-presell");
  if (!orderNumberArg) {
    console.error("Usage: npx tsx scripts/cancel-order.ts CBC9107");
    process.exit(1);
  }

  const orderNumber = orderNumberArg.startsWith("CBC") ? orderNumberArg : `CBC${orderNumberArg}`;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, fulfilment_status, warehouse_status, customer_name")
    .eq("order_number", orderNumber)
    .single();

  if (orderError || !order) {
    console.error(`Order ${orderNumber} not found.`);
    process.exit(1);
  }

  if (order.warehouse_status === "cancelled") {
    console.log(`Order ${orderNumber} is already cancelled.`);
    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, quantity, presell_quantity")
    .eq("order_id", order.id);

  if (itemsError) throw itemsError;

  const warehouseLoc = await getDefaultWarehouseLocation(supabase);
  if (!warehouseLoc) {
    console.error("No default warehouse location found.");
    process.exit(1);
  }

  const { data: existingReturns } = await supabase
    .from("stock_movements")
    .select("product_id")
    .eq("reference_id", orderNumber)
    .in("reference_type", ["order_cancel", "order_rollback"]);

  const returnedProductIds = new Set((existingReturns ?? []).map((row) => row.product_id as string));

  console.log(`Cancelling ${orderNumber} (${order.customer_name})…`);

  for (const item of items ?? []) {
    const productId = item.product_id as string;
    const presellQty = (item.presell_quantity as number) ?? 0;
    const availableQty = (item.quantity as number) - presellQty;

    if (availableQty > 0 && !returnedProductIds.has(productId)) {
      await restoreOnHand(
        supabase,
        productId,
        availableQty,
        orderNumber,
        warehouseLoc.warehouseId,
        warehouseLoc.locationId,
      );
    }

    if (presellQty > 0 && order.fulfilment_status !== "cancelled" && !skipPresell) {
      await restorePresell(supabase, productId, presellQty);
    }
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      warehouse_status: "cancelled",
      fulfilment_status: "cancelled",
    })
    .eq("id", order.id);

  if (updateError) {
    console.error(`Failed to mark order cancelled: ${updateError.message}`);
    process.exit(1);
  }

  console.log(`\nDone. Order ${orderNumber} cancelled.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
