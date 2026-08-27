/**
 * Set all Tonies products to pre-order, shipping September 2026.
 * Moves on-hand stock into the pre-sell pool so cards show "Pre-order · September 2026".
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const SEP = "2026-09";
const DEFAULT_PRESELL_QTY = 50;

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: products, error } = await supabase
    .from("products")
    .select("id, sku, name, stock, active, status, presell_quantity")
    .ilike("brand", "%tonies%");
  if (error) throw error;

  console.log(`Tonies products: ${products?.length ?? 0}`);

  let ok = 0;
  let failed = 0;

  for (const p of products ?? []) {
    const onHand = Math.max((p.stock as number) ?? 0, 0);
    const existingPresell = Math.max((p.presell_quantity as number) ?? 0, 0);
    // Keep sellable: prefer existing stock/presell, else a default pool for active SKUs
    const isShopActive = p.active !== false && p.status !== "discontinued";
    const qty = Math.max(
      onHand,
      existingPresell,
      isShopActive ? DEFAULT_PRESELL_QTY : 0,
    );

    const { error: upErr } = await supabase
      .from("products")
      .update({
        stock: 0,
        presell_enabled: true,
        presell_quantity: qty,
        expected_arrival_month: SEP,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);

    if (upErr) {
      console.error(`FAIL ${p.sku}:`, upErr.message);
      failed++;
    } else {
      ok++;
    }
  }

  console.log(`\nUpdated ${ok}, failed ${failed}.`);
  console.log(`All Tonies → pre-order, ships ${SEP} (September 2026).`);

  const { data: sample } = await supabase
    .from("products")
    .select("sku, name, stock, presell_enabled, presell_quantity, expected_arrival_month, active")
    .ilike("brand", "%tonies%")
    .eq("active", true)
    .limit(5);
  console.log("\nSample:");
  for (const p of sample ?? []) {
    console.log(
      `  ${p.sku}  stock=${p.stock}  presell=${p.presell_quantity}  ${p.expected_arrival_month}  ${p.name?.slice(0, 40)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
