/**
 * Import Le Toy Van from GBP trade order form + Shopify UK images.
 *
 *   npx tsx scripts/import-letoyvan-ltv-order.ts
 *   npx tsx scripts/import-letoyvan-ltv-order.ts --dry
 *
 * Source workbook: GBP - LTV ORDER FORM 2026_Q2.xlsx (Order Form Master)
 * Images: letoyvan.co.uk products.json (SKU / EAN match)
 */
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import {
  fetchAllShopifyProducts,
  stripHtml,
} from "./lib/shopify-catalog-import";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const BRAND = "Le Toy Van";
const FILE = "C:/Users/Dongchen/Downloads/GBP - LTV ORDER FORM 2026_Q2.xlsx";
const SHOPIFY_BASE = "https://letoyvan.co.uk";
const PRESell_MONTH = "2026-09";
const DEFAULT_PRESell_QTY = 50;
const dryRun = process.argv.includes("--dry");

type LtvRow = {
  sku: string;
  name: string;
  barcode: string | null;
  tradePrice: number | null;
  rrp: number;
  category: string | null;
};

type WebHit = {
  imageUrl: string;
  title: string;
  handle: string;
  productType: string;
  description: string;
  gallery: string[];
};

function isLtvBundle(code: string, desc: string): boolean {
  const blob = `${code} ${desc}`.toLowerCase();
  if (/\bcdu\b/.test(blob)) return true;
  if (/display unit|countertop|fsdu|printer drawer|gift set/i.test(blob)) return true;
  if (/assorted/.test(blob) && /(cars|sets|stacking|animals)/i.test(blob)) return true;
  if (/^gt900|^gt2000/i.test(code)) return true;
  if (/starter gt ser|total gt car collection/i.test(blob)) return true;
  if (/12\s+single/i.test(blob)) return true;
  if (/\bbundle\b/.test(blob)) return true;
  return false;
}

function cleanExcelName(desc: string): string {
  return desc.replace(/^No\.\s*\d+\s*-\s*/i, "").trim() || desc.trim();
}

function parseOrderForm(): LtvRow[] {
  const wb = XLSX.readFile(FILE);
  const sheet = wb.Sheets["Order Form Master"];
  if (!sheet) throw new Error("Sheet 'Order Form Master' not found");

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  const out: LtvRow[] = [];
  let category: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const itemCode = row[1] != null ? String(row[1]).trim() : "";
    const label = row[2] != null ? String(row[2]).trim() : "";
    const description = row[3] != null ? String(row[3]).trim() : "";

    // Section labels sometimes appear in column C without a separate item code row
    if (!itemCode && label && !description && label.length > 3 && !/total/i.test(label)) {
      category = label;
      continue;
    }

    const sku = itemCode;
    if (!sku || !/^[A-Z0-9][A-Z0-9\-_.]*$/i.test(sku)) continue;

    const rrp = Number(row[9]);
    if (!Number.isFinite(rrp) || rrp <= 0) continue;

    const desc = description || label;
    if (!desc) continue;
    if (isLtvBundle(sku, desc)) continue;

    const trade = Number(row[8]);
    const eanRaw = row[6] != null ? String(row[6]).trim() : "";
    const barcode = /^\d{8,14}$/.test(eanRaw) ? eanRaw : null;

    out.push({
      sku,
      name: cleanExcelName(desc),
      barcode,
      tradePrice: Number.isFinite(trade) && trade > 0 ? Math.round(trade * 100) / 100 : null,
      rrp: Math.round(rrp * 100) / 100,
      category,
    });
  }

  const bySku = new Map<string, LtvRow>();
  for (const row of out) bySku.set(row.sku.toUpperCase(), row);
  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

async function buildWebIndex(): Promise<{
  bySku: Map<string, WebHit>;
  byEan: Map<string, WebHit>;
}> {
  const products = await fetchAllShopifyProducts(SHOPIFY_BASE);
  const bySku = new Map<string, WebHit>();
  const byEan = new Map<string, WebHit>();

  for (const raw of products) {
    const title = String(raw.title ?? "").trim();
    const handle = String(raw.handle ?? "").trim();
    const productType = String(raw.product_type ?? "").trim();
    const description = stripHtml(String(raw.body_html ?? "")).slice(0, 2000);
    const images = Array.isArray(raw.images)
      ? (raw.images as { src?: string; variant_ids?: number[] }[])
      : [];
    const gallery = images.map((img) => img.src).filter(Boolean) as string[];

    for (const variant of (raw.variants as Record<string, unknown>[]) ?? []) {
      const sku = String(variant.sku ?? "").trim().toUpperCase();
      const ean = String(variant.barcode ?? "").trim();
      const variantId = Number(variant.id);
      const imageUrl =
        images.find((img) => img.variant_ids?.includes(variantId))?.src ??
        gallery[0] ??
        "";

      const hit: WebHit = {
        imageUrl,
        title,
        handle,
        productType,
        description,
        gallery,
      };

      if (sku) bySku.set(sku, hit);
      if (ean) byEan.set(ean, hit);
    }
  }

  return { bySku, byEan };
}

function buildTags(handle: string | null, shopifyTags: string[] = []): string[] {
  const group = handle ?? "single";
  return [...shopifyTags, `cbc_vgroup:${group}`, "cbc_listing", "cbc_vcount:1"];
}

async function main() {
  const rows = parseOrderForm();
  console.log(`Parsed ${rows.length} Le Toy Van SKU(s) from order form (bundles excluded).\n`);

  console.log("Indexing letoyvan.co.uk for images…");
  const web = await buildWebIndex();
  console.log(`  Shopify SKU index: ${web.bySku.size}\n`);

  if (dryRun) {
    let matched = 0;
    for (const row of rows) {
      const hit = web.bySku.get(row.sku.toUpperCase()) ?? (row.barcode ? web.byEan.get(row.barcode) : null);
      if (hit) matched++;
    }
    console.log(`Would import ${rows.length} products (${matched} with Shopify images).`);
    for (const row of rows.slice(0, 10)) {
      const hit = web.bySku.get(row.sku.toUpperCase());
      console.log(`  ${row.sku}  £${row.rrp.toFixed(2)}  ${hit?.imageUrl ? "img" : "no img"}  ${row.name.slice(0, 50)}`);
    }
    console.log("\nDRY RUN — no database writes.");
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let ok = 0;
  let failed = 0;
  let withImage = 0;
  let matchedWeb = 0;

  for (const row of rows) {
    const hit =
      web.bySku.get(row.sku.toUpperCase()) ??
      (row.barcode ? web.byEan.get(row.barcode) : undefined);

    if (hit) matchedWeb++;

    const name = hit?.title ? hit.title : `Le Toy Van ${row.name}`;
    const category = hit?.productType || row.category;
    const description = hit?.description || null;
    const imageUrl = hit?.imageUrl || null;
    const gallery = hit?.gallery?.filter((url) => url && url !== imageUrl) ?? [];

    if (imageUrl) withImage++;

    const payload = {
      sku: row.sku,
      name,
      brand: BRAND,
      category,
      description,
      barcode: row.barcode,
      cost_price: row.tradePrice,
      price: row.rrp,
      retail_price: row.rrp,
      currency: "GBP",
      stock: 0,
      active: true,
      status: "active",
      image_url: imageUrl,
      gallery_images: gallery,
      presell_enabled: true,
      presell_quantity: DEFAULT_PRESell_QTY,
      expected_arrival_month: PRESell_MONTH,
      tags: buildTags(hit?.handle ?? null),
      organization_id: ORG_ID,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
    if (error) {
      console.error(`FAIL ${row.sku}:`, error.message);
      failed++;
    } else {
      ok++;
      if (ok % 25 === 0) console.log(`  upserted ${ok}/${rows.length}…`);
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Upserted:        ${ok}`);
  console.log(`Failed:          ${failed}`);
  console.log(`Shopify matched: ${matchedWeb}/${rows.length}`);
  console.log(`With image URL:  ${withImage}`);
  console.log(`Pre-order:       ${PRESell_MONTH} (qty ${DEFAULT_PRESell_QTY} per SKU)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
