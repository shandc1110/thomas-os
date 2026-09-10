/**
 * Apply 0017 DDL using service-role workaround when Management API token is absent.
 * Tries: (1) Management API if SUPABASE_ACCESS_TOKEN set
 *        (2) supabase-js cannot run DDL — prints SQL
 * Then seeds CT7013 channel prices without touching community price.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "./load-env";

loadEnv();

const CT7013_ID = "3fe3be28-7bf2-4715-9155-bc1bb0ece79b";
const projectRef = "yrpjtaqdwieavlhathvo";
const migrationFile = resolve("supabase/migrations/0017_channel_commercial_prices.sql");

async function tryManagementApi(sql: string): Promise<boolean> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return false;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body}`);
  console.log("DDL applied via Management API.");
  return true;
}

async function columnExists(
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const { error } = await supabase.from("products").select("joybuy_price").limit(1);
  if (!error) return true;
  if (/joybuy_price|column/i.test(error.message)) return false;
  // other errors — assume missing
  console.warn("Column probe warning:", error.message);
  return false;
}

async function seedCt7013(supabase: ReturnType<typeof createClient>) {
  const { data: before } = await supabase
    .from("products")
    .select("sku,price,currency,shopify_price,joybuy_price,cost_price,retail_price")
    .eq("id", CT7013_ID)
    .single();

  console.log("CT7013 before:", JSON.stringify(before, null, 2));

  const { data, error } = await supabase
    .from("products")
    .update({
      shopify_price: 29.99,
      joybuy_price: 29.99,
      updated_at: new Date().toISOString(),
    })
    .eq("id", CT7013_ID)
    .select("sku,price,currency,shopify_price,joybuy_price,cost_price,retail_price")
    .single();

  if (error) throw new Error(error.message);

  console.log("CT7013 after:", JSON.stringify(data, null, 2));

  if (Number(data.price) !== 95 || String(data.currency).toUpperCase() !== "CNY") {
    throw new Error("Community price/currency changed — abort.");
  }
  if (Number(data.shopify_price) !== 29.99) {
    throw new Error("shopify_price not 29.99");
  }
  if (Number(data.joybuy_price) !== 29.99) {
    throw new Error("joybuy_price not 29.99");
  }
}

async function main() {
  const sql = readFileSync(migrationFile, "utf8");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let applied = false;
  try {
    applied = await tryManagementApi(sql);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }

  if (!applied) {
    const exists = await columnExists(supabase);
    if (!exists) {
      console.error("\n=== ACTION REQUIRED ===");
      console.error("Paste this SQL in Supabase → SQL Editor, then re-run:\n");
      console.error(sql);
      console.error("\nnpx tsx scripts/apply-0017-channel-commercial.ts");
      process.exit(1);
    }
    console.log("joybuy_price column already present.");
  }

  await seedCt7013(supabase);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
