/**
 * Apply MiDeer pre-sell from PI + shipment tracker rules:
 * - 已发货 (already shipped) → expected arrival August 2026
 * - Everything else → expected arrival September 2026
 */
import * as XLSX from "xlsx";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const AUG = "2026-08";
const SEP = "2026-09";

/** Shipment tracker: marked 已发货 → arriving 1 Aug */
const SHIPPED_AUG: Record<string, number> = {
  CT2216: 60,
  CT7013: 200,
  MD4282: 12,
  MK9132: 30,
  MK2477: 100,
};

/** Shipment tracker: not yet shipped → arriving 1 Sep */
const IN_TRANSIT_SEP: Record<string, number> = {
  MD1528: 24,
  MD2372: 12,
  MD1771: 100,
  MD2299: 18,
};

function resolvePresell(sku: string, piPcs: number) {
  if (sku in SHIPPED_AUG) {
    return {
      presell_enabled: true,
      presell_quantity: SHIPPED_AUG[sku],
      expected_arrival_month: AUG,
      source: "shipped → Aug",
    };
  }
  if (sku in IN_TRANSIT_SEP) {
    return {
      presell_enabled: true,
      presell_quantity: IN_TRANSIT_SEP[sku],
      expected_arrival_month: SEP,
      source: "in transit → Sep",
    };
  }
  // All other PI lines: pre-sell, arriving September
  return {
    presell_enabled: true,
    presell_quantity: piPcs,
    expected_arrival_month: SEP,
    source: "PI → Sep",
  };
}

type PiRow = {
  sku: string;
  name: string;
  unitPrice: number;
  pcs: number;
  remark: string;
};

function parsePiRows(): PiRow[] {
  const filePath = path.join(__dirname, "mideer-pi.xlsx");
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets["Mideer"];
  if (!sheet) throw new Error('Sheet "Mideer" not found');

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  });

  const out: PiRow[] = [];
  for (let i = 10; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row[0] ?? "").trim();
    if (!sku || sku.toLowerCase() === "total") break;

    const name = String(row[1] ?? "").trim();
    const unitPrice = Number(row[2]) || 0;
    const pcs = Number(row[3]) || 0;
    const remark = String(row[7] ?? "").trim();

    if (pcs <= 0 && remark.toLowerCase().includes("free sample")) continue;
    if (pcs <= 0) continue;

    out.push({ sku, name, unitPrice, pcs, remark });
  }
  return out;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const piRows = parsePiRows();
  const piSkus = new Set(piRows.map((r) => r.sku));

  // Shipment-only SKUs not on this PI sheet
  const extraSkus = Object.keys({ ...SHIPPED_AUG, ...IN_TRANSIT_SEP }).filter(
    (s) => !piSkus.has(s),
  );

  const updates: {
    sku: string;
    name: string;
    cost_price: number | null;
    price: number | null;
    retail_price: number | null;
    presell_enabled: boolean;
    presell_quantity: number;
    expected_arrival_month: string;
    source: string;
  }[] = [];

  for (const row of piRows) {
    const presell = resolvePresell(row.sku, row.pcs);
    const unitPrice = row.unitPrice > 0 ? row.unitPrice : null;
    updates.push({
      sku: row.sku,
      name: row.name,
      cost_price: unitPrice,
      price: unitPrice,
      retail_price: unitPrice,
      ...presell,
    });
  }

  for (const sku of extraSkus) {
    const presell = resolvePresell(sku, SHIPPED_AUG[sku] ?? IN_TRANSIT_SEP[sku] ?? 0);
    updates.push({
      sku,
      name: sku,
      cost_price: null,
      price: null,
      retail_price: null,
      ...presell,
    });
  }

  console.log(`Applying pre-sell to ${updates.length} SKUs...\n`);

  let ok = 0;
  let failed = 0;

  for (const u of updates) {
    const payload = {
      sku: u.sku,
      name: u.name,
      brand: "Mideer",
      active: true,
      cost_price: u.cost_price,
      price: u.price,
      retail_price: u.retail_price,
      presell_enabled: u.presell_enabled,
      presell_quantity: u.presell_quantity,
      expected_arrival_month: u.expected_arrival_month,
      organization_id: "00000000-0000-0000-0000-000000000001",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });

    if (error) {
      console.error(`FAIL ${u.sku}: ${error.message}`);
      failed++;
    } else {
      const month = u.expected_arrival_month === AUG ? "Aug 2026" : "Sep 2026";
      console.log(`OK   ${u.sku.padEnd(14)} qty ${String(u.presell_quantity).padStart(4)} → ${month} (${u.source})`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} updated, ${failed} failed.`);
  if (failed > 0) {
    console.log("\nIf errors mention missing columns, run migration 0010_presell.sql in Supabase first.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
