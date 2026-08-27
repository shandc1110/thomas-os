/**
 * Import Tonies Blink24 order form — all SKUs at GBP RRP (SRP).
 *
 * Usage (from web/):
 *   npx tsx scripts/import-tonies-blink24.ts
 *   npx tsx scripts/import-tonies-blink24.ts --dry
 */
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const FILE =
  "C:/Users/Dongchen/Downloads/Tonies Blink24 Order Form- AUGUST RELEASES (2) (1).xlsx";
const dryRun = process.argv.includes("--dry");

type TonieRow = {
  sku: string;
  barcode: string | null;
  name: string;
  age: string | null;
  availability: string;
  cost: number;
  srp: number;
  category: string | null;
  stock: number;
};

function stockFromAvailability(avail: string): number {
  const a = avail.toLowerCase();
  if (a.includes("out of stock")) return 0;
  if (a.includes("low")) return 5;
  if (a.includes("in stock")) return 50;
  return 0;
}

function parseRows(): TonieRow[] {
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets["Blink24 Order Form"];
  if (!sheet) throw new Error('Sheet "Blink24 Order Form" not found');

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const out: TonieRow[] = [];
  let category: string | null = null;

  for (let i = 7; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const col0 = row[0];
    const item = row[1];
    const nameRaw = row[2];

    // Section headers live in column A with no item number
    if (
      (item == null || item === "") &&
      typeof col0 === "string" &&
      col0.trim() &&
      !/^\d+$/.test(col0.trim())
    ) {
      category = col0.trim();
      continue;
    }

    const sku = item != null ? String(item).trim() : "";
    if (!/^\d{5,}$/.test(sku)) continue;

    const name = String(nameRaw ?? "").trim();
    if (!name) continue;

    const srp = Number(row[7]);
    if (!Number.isFinite(srp) || srp <= 0) continue;

    const cost = Number(row[6]);
    const availability = String(row[5] ?? "").trim();
    const age = row[3] != null ? String(row[3]).trim() : null;
    const barcode =
      col0 != null && String(col0).trim() && /^\d+$/.test(String(col0).trim())
        ? String(col0).trim()
        : null;

    out.push({
      sku,
      barcode,
      name,
      age: age || null,
      availability,
      cost: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) / 100 : 0,
      srp: Math.round(srp * 100) / 100,
      category,
      stock: stockFromAvailability(availability),
    });
  }

  // Deduplicate by SKU (last wins)
  const bySku = new Map<string, TonieRow>();
  for (const row of out) bySku.set(row.sku, row);
  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

async function main() {
  const rows = parseRows();
  console.log(`Parsed ${rows.length} Tonies SKU(s) with GBP RRP.\n`);
  console.log(
    `In stock: ${rows.filter((r) => r.stock >= 50).length}, low: ${rows.filter((r) => r.stock > 0 && r.stock < 50).length}, out: ${rows.filter((r) => r.stock === 0).length}`,
  );
  console.log(
    `SRP range: £${Math.min(...rows.map((r) => r.srp)).toFixed(2)} – £${Math.max(...rows.map((r) => r.srp)).toFixed(2)}`,
  );

  if (dryRun) {
    for (const r of rows.slice(0, 8)) {
      console.log(`  ${r.sku}  £${r.srp.toFixed(2)}  stock=${r.stock}  ${r.name.slice(0, 50)}`);
    }
    console.log("\nDRY RUN — no DB writes.");
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  let ok = 0;
  let failed = 0;
  const batchSize = 50;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const payload = chunk.map((r) => ({
      sku: r.sku,
      name: r.name,
      brand: "Tonies",
      category: r.category,
      description: r.age ? `Age ${r.age}` : null,
      barcode: r.barcode,
      cost_price: r.cost > 0 ? r.cost : null,
      price: r.srp,
      retail_price: r.srp,
      currency: "GBP",
      stock: r.stock,
      active: true,
      status: "active",
      presell_enabled: false,
      presell_quantity: 0,
      expected_arrival_month: null,
      organization_id: ORG_ID,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
    if (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error.message);
      // Fallback row-by-row
      for (const row of payload) {
        const { error: rowError } = await supabase
          .from("products")
          .upsert(row, { onConflict: "sku" });
        if (rowError) {
          console.error(`FAIL ${row.sku}:`, rowError.message);
          failed++;
        } else {
          ok++;
        }
      }
    } else {
      ok += chunk.length;
      console.log(`OK batch ${i / batchSize + 1}: ${chunk.length} products`);
    }
  }

  console.log(`\nDone: ${ok} upserted, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
