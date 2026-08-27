/**
 * Set assortment_status = retired for Tonies and Micro Scooters products.
 * Updates only assortment_status and updated_at.
 *
 *   npx tsx scripts/retire-tonies-micro-assortment.ts
 *   npx tsx scripts/retire-tonies-micro-assortment.ts --dry
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const DRY = process.argv.includes("--dry");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, brand, assortment_status, active, status, stock, price")
    .or("brand.ilike.%tonies%,brand.ilike.%micro%");

  if (error) throw error;

  const products = data ?? [];
  const byBrand = new Map<string, number>();
  for (const p of products) {
    const brand = String(p.brand ?? "Unknown");
    byBrand.set(brand, (byBrand.get(brand) ?? 0) + 1);
  }

  console.log(`Matched ${products.length} products:`);
  for (const [brand, count] of [...byBrand.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}  ${brand}`);
  }

  const toUpdate = products.filter((p) => p.assortment_status !== "retired");
  console.log(`\n${toUpdate.length} need assortment_status → retired (${products.length - toUpdate.length} already retired).`);

  if (toUpdate.length === 0) return;

  if (DRY) {
    console.log("\n--dry: no changes written.");
    for (const p of toUpdate.slice(0, 10)) {
      console.log(`  ${p.sku}  ${p.brand}  (${p.assortment_status ?? "not reviewed"})`);
    }
    if (toUpdate.length > 10) console.log(`  … and ${toUpdate.length - 10} more`);
    return;
  }

  const ids = toUpdate.map((p) => p.id);
  const { data: updated, error: upErr } = await supabase
    .from("products")
    .update({
      assortment_status: "retired",
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .select("id, sku, brand, assortment_status, active, status, stock, price");

  if (upErr) throw upErr;

  console.log(`\nUpdated ${updated?.length ?? 0} products to retired.`);

  const sample = updated?.[0];
  if (sample) {
    console.log("Sample row after update (other fields unchanged):");
    console.log({
      sku: sample.sku,
      assortment_status: sample.assortment_status,
      active: sample.active,
      status: sample.status,
      stock: sample.stock,
      price: sample.price,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
