/**
 * Import MiDeer Sep 2026 PI (MDUK2026090401) into products (pre-sell, active, priced).
 * Ready to ship end of October → expected_arrival_month 2026-10.
 * New-SKU console price = cost × 1.9 + weight_kg × 15 × 1.5, rounded up to nearest 9.
 */
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { calcNewSkuConsolePrice } from "@/lib/pricing";
import { loadEnv } from "./load-env";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const ARRIVAL = "2026-10";
const dryRun = process.argv.includes("--dry");

const FILES = [
  {
    path: "C:/Users/Dongchen/Documents/WeChat Files/Victoriasdc/FileStorage/File/2026-09/PI-MiDeer for Chosen by Chole 20260911新.xlsx",
    sheets: ["total"] as const,
    label: "MDUK2026090401",
  },
];

type PiLine = {
  sku: string;
  name: string;
  cost: number;
  pcs: number;
  weightKg: number;
  remark: string;
  source: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseSheet(filePath: string, sheetName: string, label: string): PiLine[] {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const out: PiLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const sku = String(row[0] ?? "").trim().toUpperCase();
    if (!/^[A-Z]{1,3}\d{3,5}(-[A-Z0-9]+)?$/i.test(sku)) continue;

    const name = String(row[1] ?? "").trim();
    const cost = Number(row[2]) || 0;
    const pcs = Number(row[3]) || 0;
    const remark = String(row[7] ?? "").trim().toLowerCase();
    const weightKg = Number(row[8]) || 0;

    if (remark.includes("free sample") || remark.includes("aftersales")) continue;
    if (pcs <= 0) continue;
    if (!name) continue;

    out.push({
      sku,
      name,
      cost,
      pcs,
      weightKg,
      remark,
      source: `${label}/${sheetName}`,
    });
  }
  return out;
}

async function main() {
  const bySku = new Map<string, PiLine>();

  for (const file of FILES) {
    for (const sheet of file.sheets) {
      for (const line of parseSheet(file.path, sheet, file.label)) {
        const existing = bySku.get(line.sku);
        if (!existing) {
          bySku.set(line.sku, line);
          continue;
        }
        if (line.cost > 0 || existing.cost <= 0) {
          bySku.set(line.sku, {
            ...line,
            pcs: Math.max(existing.pcs, line.pcs),
            weightKg: line.weightKg > 0 ? line.weightKg : existing.weightKg,
            name: line.name || existing.name,
            cost: line.cost > 0 ? line.cost : existing.cost,
          });
        } else {
          bySku.set(line.sku, {
            ...existing,
            pcs: Math.max(existing.pcs, line.pcs),
          });
        }
      }
    }
  }

  const lines = [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const totalPcs = lines.reduce((s, l) => s + l.pcs, 0);
  console.log(`Parsed ${lines.length} sellable SKU(s) / ${totalPcs} pcs from PI MDUK2026090401.\n`);
  for (const l of lines) {
    const price = l.cost > 0 ? calcNewSkuConsolePrice(l.cost, l.weightKg) : null;
    console.log(
      `  ${l.sku.padEnd(10)} pcs ${String(l.pcs).padStart(3)}  cost ¥${l.cost.toFixed(2).padStart(8)}  wt ${l.weightKg.toFixed(3)}kg  → ¥${price?.toFixed(2) ?? "—"}\t${l.name.slice(0, 50)}`,
    );
  }

  if (dryRun) {
    console.log("\nDRY RUN — no DB writes.");
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: existing, error: fetchError } = await supabase
    .from("products")
    .select("id, sku, price, stock, image_url")
    .in(
      "sku",
      lines.map((l) => l.sku),
    );
  if (fetchError) throw fetchError;

  const existingBySku = new Map(
    (existing ?? []).map((p) => [String(p.sku).toUpperCase(), p] as const),
  );

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const line of lines) {
    const price = line.cost > 0 ? calcNewSkuConsolePrice(line.cost, line.weightKg) : null;
    const prev = existingBySku.get(line.sku);
    const weightGrams =
      line.weightKg > 0 ? Math.round(line.weightKg * 1000) : null;

    const payload: Record<string, unknown> = {
      sku: line.sku,
      name: line.name,
      brand: "Mideer",
      active: true,
      cost_price: line.cost > 0 ? round2(line.cost) : null,
      price: price ?? prev?.price ?? null,
      retail_price: price ?? prev?.price ?? null,
      weight_grams: weightGrams,
      presell_enabled: true,
      presell_quantity: line.pcs,
      expected_arrival_month: ARRIVAL,
      organization_id: ORG_ID,
      updated_at: new Date().toISOString(),
    };

    // Don't wipe on-hand stock if product already exists
    if (!prev) {
      payload.stock = 0;
    }

    const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
    if (error) {
      console.error(`FAIL ${line.sku}: ${error.message}`);
      failed++;
    } else if (prev) {
      console.log(`UPD  ${line.sku.padEnd(10)} pre-sell ${line.pcs} → Oct 2026  ¥${price ?? "—"}`);
      updated++;
    } else {
      console.log(`NEW  ${line.sku.padEnd(10)} pre-sell ${line.pcs} → Oct 2026  ¥${price ?? "—"}`);
      inserted++;
    }
  }

  console.log(`\nDone: ${inserted} new, ${updated} updated, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
