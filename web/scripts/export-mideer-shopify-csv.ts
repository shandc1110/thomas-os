/**
 * Export Mideer products to a Shopify product import CSV, priced in GBP.
 *
 * Only products with a positive shopify_price are exported. Products missing
 * a Shopify UK price are written to a separate report so they can be priced
 * in Admin → Inventory → Pricing before re-running.
 *
 * Usage (from the `web` folder):
 *   npx tsx scripts/export-mideer-shopify-csv.ts
 *   npx tsx scripts/export-mideer-shopify-csv.ts C:\path\import.csv C:\path\missing.csv
 *
 * Import the ready CSV in Shopify admin: Products → Import.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Barcode",
  "Variant Grams",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Image Src",
  "Status",
];

const MISSING_HEADERS = ["SKU", "Name", "Console price", "Currency", "Stock", "Pre-sell qty", "Has image"];

type ProductRow = {
  sku: string | null;
  name: string | null;
  description: string | null;
  brand: string | null;
  category: string | null;
  barcode?: string | null;
  weight_grams: number | null;
  active: boolean | null;
  price: number | null;
  currency: string | null;
  shopify_price: number | null;
  stock: number | null;
  presell_enabled: boolean | null;
  presell_quantity: number | null;
  image_url: string | null;
};

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function handleFrom(sku: string, name: string): string {
  return `mideer-${(sku || name || "product").toString()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function writeCsv(path: string, headers: string[], records: Record<string, unknown>[]) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [headers.map(csvCell).join(",")];
  for (const r of records) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  writeFileSync(path, "\uFEFF" + lines.join("\r\n"), "utf8");
}

async function run() {
  const outPath = resolve(process.cwd(), process.argv[2] ?? "./tmp/mideer-shopify-import.csv");
  const missingPath = resolve(
    process.cwd(),
    process.argv[3] ?? "./tmp/mideer-shopify-price-missing.csv",
  );

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .ilike("brand", "%mideer%")
    .order("sku");
  if (error) {
    console.error("ERROR loading products:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as ProductRow[];
  const ready = rows.filter((r) => Number(r.shopify_price) > 0);
  const missing = rows.filter((r) => !(Number(r.shopify_price) > 0));

  const readyRecords = ready.map((r) => {
    const presell = r.presell_enabled === true && Number(r.presell_quantity) > 0;
    return {
      Handle: handleFrom(r.sku ?? "", r.name ?? ""),
      Title: r.name ?? r.sku ?? "Untitled",
      "Body (HTML)": r.description ?? "",
      Vendor: "Mideer",
      Type: r.category ?? "",
      Tags: ["Mideer", r.category, presell ? "Pre-order" : null].filter(Boolean).join(", "),
      Published: r.active ? "TRUE" : "FALSE",
      "Option1 Name": "Title",
      "Option1 Value": "Default Title",
      "Variant SKU": r.sku ?? "",
      "Variant Barcode": r.barcode ?? "",
      "Variant Grams": r.weight_grams ?? "",
      "Variant Inventory Tracker": "shopify",
      "Variant Inventory Qty": Math.max(0, Number(r.stock) || 0),
      "Variant Inventory Policy": presell ? "continue" : "deny",
      "Variant Fulfillment Service": "manual",
      "Variant Price": Number(r.shopify_price).toFixed(2),
      "Variant Requires Shipping": "TRUE",
      "Variant Taxable": "TRUE",
      "Image Src": r.image_url ?? "",
      Status: r.active ? "active" : "draft",
    };
  });

  const missingRecords = missing.map((r) => ({
    SKU: r.sku ?? "",
    Name: r.name ?? "",
    "Console price": r.price ?? "",
    Currency: r.currency ?? "",
    Stock: r.stock ?? 0,
    "Pre-sell qty": r.presell_enabled ? (r.presell_quantity ?? 0) : 0,
    "Has image": r.image_url ? "yes" : "no",
  }));

  writeCsv(outPath, HEADERS, readyRecords);
  writeCsv(missingPath, MISSING_HEADERS, missingRecords);

  console.log(`Mideer products: ${rows.length}`);
  console.log(`Exported ${ready.length} with Shopify GBP price → ${outPath}`);
  const noImage = ready.filter((r) => !r.image_url).length;
  if (noImage) console.log(`  ${noImage} exported product(s) have no image.`);

  if (missing.length) {
    console.log(
      `\nALERT: ${missing.length} Mideer product(s) have no Shopify price and were NOT exported.`,
    );
    console.log(`Set them in Admin → Inventory → Pricing, then re-run. Full list → ${missingPath}`);
    for (const r of missing) {
      console.log(`  ${String(r.sku ?? "").padEnd(12)} ${(r.name ?? "").slice(0, 60)}`);
    }
  }
}

run();
