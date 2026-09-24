/**
 * Safe Joybuy dry-run — maps Thomas products to outgoing payloads WITHOUT calling Joybuy.
 *
 * Default scope: assortment_status = 'active' (Chosen by Chloe Active Assortment).
 *
 * Usage (from web/):
 *   npx tsx scripts/joybuy-dry-run.ts
 *   npx tsx scripts/joybuy-dry-run.ts --limit 5
 *   npx tsx scripts/joybuy-dry-run.ts --sku TV273
 *
 * Never imports getJoybuyClient / never sends HTTP.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Product } from "../lib/types";
import { buildJoybuyInventoryPayload } from "../lib/integrations/joybuy/inventory";
import { buildJoybuyPricePayload } from "../lib/integrations/joybuy/pricing";
import { mapProductToJoybuy } from "../lib/integrations/joybuy/products";
import { loadEnv } from "./load-env";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const onlySku = argValue("--sku")?.trim();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let query = sb
    .from("products")
    .select("*")
    .eq("organization_id", ORG_ID)
    .eq("assortment_status", "active")
    .order("sku", { ascending: true });

  if (onlySku) query = query.eq("sku", onlySku);
  if (limit && Number.isFinite(limit) && limit > 0) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  const products = (data ?? []) as Product[];
  const rows = [];

  for (const product of products) {
    try {
      const mapped = mapProductToJoybuy(product);
      const inventory = buildJoybuyInventoryPayload(product);
      const price = buildJoybuyPricePayload(product);
      rows.push({
        internalProductId: mapped.internalProductId,
        sku: mapped.sku,
        title: mapped.title,
        brand: mapped.brand,
        category: mapped.category,
        price: price.price,
        currency: price.currency,
        inventory: inventory.quantity,
        onHand: inventory.onHand,
        presell: inventory.presell,
        primaryImageUrl: mapped.primaryImageUrl,
        galleryCount: mapped.galleryImageUrls.length,
        activeFlag: mapped.active,
        productActive: product.active,
        assortment_status: product.assortment_status,
        payload: { product: mapped, inventory, price },
      });
    } catch (e) {
      rows.push({
        internalProductId: String(product.id),
        sku: product.sku,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const outDir = path.join(process.cwd(), "tmp", "joybuy-dry-run");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `dry-run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    scope: "assortment_status=active",
    note: "Local mapper output only — no Joybuy API calls.",
    count: rows.length,
    rows,
  };
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`Joybuy dry-run (NO API CALLS)`);
  console.log(`Scope: assortment_status=active`);
  console.log(`Products mapped: ${rows.length}`);
  console.log(`Output: ${outFile}\n`);

  for (const row of rows) {
    if ("error" in row && row.error) {
      console.log(`FAIL  ${row.sku ?? "?"}  ${row.error}`);
      continue;
    }
    console.log(
      `${row.sku}  £/¥ ${row.price ?? "—"} ${row.currency ?? ""}  stock ${row.inventory} (onHand ${row.onHand} + presell ${row.presell})  ${row.brand ?? "—"} / ${row.category ?? "—"}  img ${row.primaryImageUrl ? "yes" : "NO"}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
