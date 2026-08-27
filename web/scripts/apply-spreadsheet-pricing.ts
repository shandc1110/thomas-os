/**
 * Apply data from Chosen by Chloe New Arrival spreadsheet.
 *
 * Console price (price / retail_price):
 *   order_price × 1.25 + weight_kg × 14 × 1.25, rounded up to nearest 9
 *
 * By default does NOT overwrite console prices you already set.
 * Never touches shopify_price (set manually in Admin → Pricing).
 *
 * Also updates: cost_price, weight_grams, dimensions.
 *
 * Usage (from web/):
 *   npx tsx scripts/apply-spreadsheet-pricing.ts
 *   npx tsx scripts/apply-spreadsheet-pricing.ts --dry
 *   npx tsx scripts/apply-spreadsheet-pricing.ts --force-console-prices
 */
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { calcConsolePrice, round2 } from "@/lib/pricing";
import { loadEnv } from "./load-env";

loadEnv();

const FILE =
  "C:/Users/Dongchen/Desktop/20260715Chosen by Chole&New Arrival Products List-260701-new exchange rate.xlsx";
const dryRun = process.argv.includes("--dry");
const forceConsole = process.argv.includes("--force-console-prices");

type Row = {
  sku: string;
  name: string;
  orderPrice: number;
  weightKg: number;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  consolePrice: number;
};

function parseRows(): Row[] {
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets["July 2026"];
  if (!sheet) throw new Error('Sheet "July 2026" not found');

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  const out: Row[] = [];
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row[1] ?? "").trim();
    if (!sku || sku.toLowerCase() === "id") continue;

    const orderPrice = Number(row[10]);
    const weightKg = Number(row[12]);
    if (!Number.isFinite(orderPrice) || orderPrice <= 0) continue;
    if (!Number.isFinite(weightKg) || weightKg < 0) continue;

    const lengthCm = Number(row[13]);
    const widthCm = Number(row[14]);
    const heightCm = Number(row[15]);

    out.push({
      sku,
      name: String(row[2] ?? "").trim(),
      orderPrice,
      weightKg,
      lengthMm: Number.isFinite(lengthCm) && lengthCm > 0 ? Math.round(lengthCm * 10) : null,
      widthMm: Number.isFinite(widthCm) && widthCm > 0 ? Math.round(widthCm * 10) : null,
      heightMm: Number.isFinite(heightCm) && heightCm > 0 ? Math.round(heightCm * 10) : null,
      consolePrice: calcConsolePrice(orderPrice, weightKg),
    });
  }
  return out;
}

async function main() {
  const parsed = parseRows();
  console.log(`Parsed ${parsed.length} priced rows from spreadsheet.`);
  console.log("Shopify prices will NOT be changed (set manually).");
  console.log(
    forceConsole
      ? "FORCE: overwriting existing console prices.\n"
      : "Keeping existing console prices; only filling blanks.\n",
  );
  if (dryRun) console.log("DRY RUN — no database changes.\n");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: products, error } = await supabase.from("products").select("id, sku, price");
  if (error) throw error;

  const bySku = new Map<string, { id: string; price: number | null }>();
  for (const p of products ?? []) {
    if (p.sku) {
      bySku.set(String(p.sku).toUpperCase(), {
        id: String(p.id),
        price: p.price != null ? Number(p.price) : null,
      });
    }
  }

  let updated = 0;
  let kept = 0;
  let missing = 0;
  const missingSkus: string[] = [];

  for (const row of parsed) {
    const existing = bySku.get(row.sku.toUpperCase());
    if (!existing) {
      missing++;
      missingSkus.push(row.sku);
      continue;
    }

    const weightGrams = Math.round(row.weightKg * 1000);
    const hasConsole = (existing.price ?? 0) > 0;
    const setConsole = forceConsole || !hasConsole;

    const payload: Record<string, unknown> = {
      cost_price: round2(row.orderPrice),
      weight_grams: weightGrams,
      length_mm: row.lengthMm,
      width_mm: row.widthMm,
      height_mm: row.heightMm,
      updated_at: new Date().toISOString(),
    };

    if (setConsole) {
      payload.price = row.consolePrice;
      payload.retail_price = row.consolePrice;
    } else {
      kept++;
    }

    const priceNote = setConsole
      ? `console ¥${row.consolePrice.toFixed(2)}`
      : `console kept ¥${existing.price!.toFixed(2)} (formula would be ¥${row.consolePrice.toFixed(2)})`;

    console.log(
      `${dryRun ? "WOULD " : ""}OK  ${row.sku.padEnd(14)} ${priceNote} · ${weightGrams}g`,
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", existing.id);
      if (updateError) {
        console.error(`FAIL ${row.sku}: ${updateError.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`\nDone: ${updated} products ${dryRun ? "would be updated" : "updated"}.`);
  if (kept > 0) {
    console.log(`Console prices left unchanged on ${kept} product(s). Use --force-console-prices to overwrite.`);
  }
  if (missing > 0) {
    console.log(
      `Spreadsheet SKUs not in catalog (${missing}): ${missingSkus.slice(0, 30).join(", ")}${missingSkus.length > 30 ? "…" : ""}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
