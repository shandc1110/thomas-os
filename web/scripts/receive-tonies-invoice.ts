/**
 * Receive Tonies stock from Blink24 invoice UKBSI01575 and list fulfillable orders.
 *
 *   npx tsx scripts/receive-tonies-invoice.ts --dry
 *   npx tsx scripts/receive-tonies-invoice.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const INVOICE_REF = "UKBSI01575";
const DRY = process.argv.includes("--dry");

/** Blink24 invoice UKBSI01575 — item no. = Tonies SKU in our DB */
const INVOICE_LINES: { sku: string; qty: number; unitCost: number; name: string }[] = [
  { sku: "10000310", qty: 3, unitCost: 7.0, name: "Nutcracker" },
  { sku: "10001374", qty: 1, unitCost: 7.42, name: "Hey Duggee" },
  { sku: "11000193", qty: 2, unitCost: 7.42, name: "Leo's Day Routines" },
  { sku: "11000416", qty: 9, unitCost: 7.42, name: "Peppa Pig" },
  { sku: "11000424", qty: 3, unitCost: 7.42, name: "Sleepy Friends" },
  { sku: "11000521", qty: 1, unitCost: 7.42, name: "Paddington" },
  { sku: "11002218", qty: 1, unitCost: 7.42, name: "Mickey Mouse Clubhouse" },
  { sku: "11002272", qty: 4, unitCost: 7.42, name: "Ms. Rachel" },
  { sku: "11002432", qty: 4, unitCost: 67.95, name: "Toniebox 2 Starter Red" },
  { sku: "11002434", qty: 1, unitCost: 67.95, name: "Toniebox 2 Starter Sky Blue" },
  { sku: "11002527", qty: 1, unitCost: 7.42, name: "The Wiggles" },
  { sku: "11002696", qty: 3, unitCost: 7.42, name: "Caspar Babypants" },
  { sku: "11003248", qty: 1, unitCost: 7.42, name: "Cocomelon relaunch" },
  { sku: "11003557", qty: 2, unitCost: 16.24, name: "My First Tonies Travel Set" },
  { sku: "11003563", qty: 2, unitCost: 16.24, name: "My First Tonies Jungle Set" },
];

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  stock: number;
  cost_price: number | null;
};

async function getDefaultWarehouse(sb: SupabaseClient) {
  const { data: wh } = await sb
    .from("warehouses")
    .select("id")
    .eq("is_default", true)
    .eq("active", true)
    .limit(1)
    .single();
  if (!wh) throw new Error("No default warehouse — run migration 0006.");

  const { data: loc } = await sb
    .from("warehouse_locations")
    .select("id")
    .eq("warehouse_id", wh.id)
    .eq("active", true)
    .limit(1)
    .single();
  if (!loc) throw new Error("No warehouse location.");

  return { warehouseId: wh.id as string, locationId: loc.id as string };
}

async function allocateReceiptNumber(sb: SupabaseClient): Promise<string> {
  const { count } = await sb.from("goods_receipts").select("id", { count: "exact", head: true });
  return `GRN-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function allocateMovementNumber(sb: SupabaseClient): Promise<string> {
  const { count } = await sb.from("stock_movements").select("id", { count: "exact", head: true });
  return `MOV-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

async function receiveLine(
  sb: SupabaseClient,
  product: ProductRow,
  qty: number,
  unitCost: number,
  warehouseId: string,
  locationId: string,
  receiptNumber: string,
  receiptId: string,
): Promise<void> {
  await sb.from("goods_receipt_lines").insert({
    receipt_id: receiptId,
    product_id: product.id,
    quantity_expected: qty,
    quantity_received: qty,
  });

  const { data: balance } = await sb
    .from("inventory_balances")
    .select("id, available")
    .eq("product_id", product.id)
    .eq("location_id", locationId)
    .maybeSingle();

  let balanceId: string;
  let newAvailable: number;

  if (balance) {
    balanceId = balance.id as string;
    newAvailable = ((balance.available as number) ?? 0) + qty;
    await sb
      .from("inventory_balances")
      .update({ available: newAvailable, last_updated: new Date().toISOString() })
      .eq("id", balanceId);
  } else {
    const { data: created, error } = await sb
      .from("inventory_balances")
      .insert({
        product_id: product.id,
        warehouse_id: warehouseId,
        location_id: locationId,
        available: qty,
      })
      .select("id, available")
      .single();
    if (error || !created) throw new Error(`Balance insert failed: ${error?.message}`);
    balanceId = created.id as string;
    newAvailable = qty;
  }

  const movementNumber = await allocateMovementNumber(sb);
  await sb.from("stock_movements").insert({
    movement_number: movementNumber,
    movement_type: "goods_received",
    product_id: product.id,
    sku: product.sku,
    quantity: qty,
    warehouse_id: warehouseId,
    location_id: locationId,
    reference_type: "goods_receipt",
    reference_id: receiptNumber,
    reason: `Goods receipt ${receiptNumber}`,
    notes: `Blink24 invoice ${INVOICE_REF}`,
    user_name: "receive-tonies-invoice",
    balance_after: newAvailable,
  });

  const { data: allBalances } = await sb
    .from("inventory_balances")
    .select("available")
    .eq("product_id", product.id);
  const totalStock = (allBalances ?? []).reduce((s, r) => s + ((r.available as number) ?? 0), 0);

  await sb
    .from("products")
    .update({
      stock: totalStock,
      cost_price: unitCost,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
}

type OrderAnalysis = {
  order_number: string;
  customer_name: string;
  fulfilment_status: string;
  warehouse_status: string;
  payment_method: string;
  created_at: string;
  canFulfill: boolean;
  missing: string[];
};

async function analyzeFulfillableOrders(sb: SupabaseClient): Promise<OrderAnalysis[]> {
  const { data: products } = await sb
    .from("products")
    .select("id, sku, name, stock")
    .ilike("brand", "%tonies%");

  const stockByProduct = new Map<string, number>();
  for (const p of products ?? []) {
    stockByProduct.set(p.id as string, (p.stock as number) ?? 0);
  }

  const { data: orders } = await sb
    .from("orders")
    .select(
      "id, order_number, customer_name, fulfilment_status, warehouse_status, payment_method, created_at, order_items ( quantity, presell_quantity, product_id, products ( sku, name, brand ) )",
    )
    .eq("organization_id", ORG_ID)
    .not("fulfilment_status", "eq", "fulfilled")
    .not("fulfilment_status", "eq", "cancelled")
    .order("created_at", { ascending: true });

  const pool = new Map(stockByProduct);
  const results: OrderAnalysis[] = [];

  for (const order of orders ?? []) {
    const items = (order.order_items as Array<{
      quantity: number;
      presell_quantity: number;
      product_id: string;
      products: { sku: string | null; name: string; brand: string | null } | null;
    }>) ?? [];

    const tonieItems = items.filter((i) =>
      (i.products?.brand ?? "").toLowerCase().includes("tonies"),
    );

    if (tonieItems.length === 0) continue;

    const missing: string[] = [];
    let canFulfill = true;

    for (const item of tonieItems) {
      const pid = item.product_id;
      const need = item.quantity;
      const have = pool.get(pid) ?? 0;
      if (have < need) {
        canFulfill = false;
        missing.push(
          `${item.products?.sku ?? pid} ${item.products?.name ?? "?"} (need ${need}, have ${have})`,
        );
      }
    }

    results.push({
      order_number: order.order_number as string,
      customer_name: order.customer_name as string,
      fulfilment_status: order.fulfilment_status as string,
      warehouse_status: (order.warehouse_status as string) ?? "pending",
      payment_method: (order.payment_method as string) ?? "",
      created_at: order.created_at as string,
      canFulfill,
      missing,
    });

    if (canFulfill) {
      for (const item of tonieItems) {
        const pid = item.product_id;
        pool.set(pid, (pool.get(pid) ?? 0) - item.quantity);
      }
    }
  }

  return results;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const skus = INVOICE_LINES.map((l) => l.sku);
  const { data: products, error: prodErr } = await sb
    .from("products")
    .select("id, sku, name, stock, cost_price")
    .in("sku", skus);

  if (prodErr) throw prodErr;

  const bySku = new Map<string, ProductRow>();
  for (const p of (products ?? []) as ProductRow[]) {
    bySku.set(p.sku, p);
  }

  const missingSkus = skus.filter((s) => !bySku.has(s));
  if (missingSkus.length) {
    console.log("SKUs not in database:");
    for (const s of missingSkus) console.log(`  ${s}`);
  }

  console.log(`\nMatched ${bySku.size}/${INVOICE_LINES.length} invoice lines.\n`);

  if (DRY) {
    for (const line of INVOICE_LINES) {
      const p = bySku.get(line.sku);
      console.log(
        `  ${line.sku}  +${line.qty}  ${p ? `stock ${p.stock} → ${p.stock + line.qty}` : "MISSING"}  ${line.name}`,
      );
    }
    console.log("\n--dry: no database writes.");
    return;
  }

  const { warehouseId, locationId } = await getDefaultWarehouse(sb);
  const receiptNumber = await allocateReceiptNumber(sb);

  const { data: receipt, error: receiptErr } = await sb
    .from("goods_receipts")
    .insert({
      receipt_number: receiptNumber,
      po_reference: INVOICE_REF,
      warehouse_id: warehouseId,
      location_id: locationId,
      notes: `Blink24 invoice ${INVOICE_REF} (Tonies delivery)`,
      received_by: "receive-tonies-invoice",
      status: "completed",
    })
    .select("id")
    .single();

  if (receiptErr || !receipt) throw new Error(receiptErr?.message ?? "Receipt failed");

  let received = 0;
  for (const line of INVOICE_LINES) {
    const product = bySku.get(line.sku);
    if (!product) continue;
    await receiveLine(
      sb,
      product,
      line.qty,
      line.unitCost,
      warehouseId,
      locationId,
      receiptNumber,
      receipt.id as string,
    );
    received++;
    console.log(`  received ${line.qty} × ${line.sku} (${product.name})`);
  }

  console.log(`\nGoods receipt ${receiptNumber}: ${received} lines, invoice ${INVOICE_REF}`);

  const analysis = await analyzeFulfillableOrders(sb);
  const ready = analysis.filter((o) => o.canFulfill);
  const waiting = analysis.filter((o) => !o.canFulfill);

  console.log("\n========== ORDERS YOU CAN FULFIL NOW (FIFO) ==========");
  if (ready.length === 0) {
    console.log("None — stock may not cover awaiting pre-orders yet, or no Tonies orders waiting.");
  } else {
    for (const o of ready) {
      console.log(
        `  ${o.order_number}  ${o.customer_name}  [${o.fulfilment_status}]  pay: ${o.payment_method}`,
      );
    }
  }

  console.log("\n========== TONIES ORDERS STILL WAITING ==========");
  for (const o of waiting.slice(0, 20)) {
    console.log(`  ${o.order_number}  ${o.customer_name}`);
    for (const m of o.missing) console.log(`    - ${m}`);
  }
  if (waiting.length > 20) console.log(`  … and ${waiting.length - 20} more`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
