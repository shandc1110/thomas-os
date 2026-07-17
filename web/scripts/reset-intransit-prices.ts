/**
 * Reset in-transit shop prices to the original supplier cost (PI unit price in CNY).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: products, error } = await supabase
    .from("products")
    .select("id, sku, cost_price, price, retail_price, expected_arrival_month")
    .not("expected_arrival_month", "is", null);

  if (error) throw error;

  let updated = 0;
  let missingCost = 0;

  for (const product of products ?? []) {
    const cost = product.cost_price as number | null;
    if (!cost || cost <= 0) {
      missingCost++;
      console.log(`SKIP ${product.sku} — no supplier cost on file`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({
        price: cost,
        retail_price: cost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    if (updateError) {
      console.error(`FAIL ${product.sku}: ${updateError.message}`);
      continue;
    }

    updated++;
    console.log(`OK   ${product.sku} → ¥${cost}`);
  }

  console.log(`\nDone. ${updated} updated, ${missingCost} still need supplier cost entered manually.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
