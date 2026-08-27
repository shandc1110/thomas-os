/**
 * Import Micro Scooters SKUs from the Dropship spreadsheet ONLY
 * (not the full website catalogue), enrich with official UK site images/EAN,
 * and upsert into Supabase for the shop.
 *
 * Usage (from web/):
 *   npx tsx scripts/import-micro-from-dropship.ts
 *   npx tsx scripts/import-micro-from-dropship.ts --dry
 */
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const FILE = "C:/Users/Dongchen/Downloads/Dropship 2026 (2).xlsx";
const BASE = "https://www.micro-scooters.co.uk";
const dryRun = process.argv.includes("--dry");

/** Order-form sheets = shop categories (not the price-list summary). */
const CATEGORY_SHEETS = [
  "Mini & Maxi Micro's",
  "Nursery & Travel Range",
  "5+ Scooters",
  "Helmets",
  "Accessories",
] as const;

type DropshipRow = {
  sku: string;
  name: string;
  notes: string | null;
  rrp: number | null;
  cost: number | null;
  category: string;
};

type WebHit = {
  sku: string;
  barcode: string;
  title: string;
  imageUrl: string;
  productUrl: string;
  price: number | null;
  available: boolean | null;
};

function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[£,\s]/g, "").trim();
  if (!s || s === "-" || s === "£-") return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function isSku(s: string): boolean {
  return /^[A-Z0-9][A-Z0-9\-_/]{2,}$/i.test(s) && !/^(MODEL|NOTES|DESCRIPTION|RRP|PRICE|QTY)$/i.test(s);
}

function parseDropship(): DropshipRow[] {
  const wb = XLSX.readFile(FILE);
  const bySku = new Map<string, DropshipRow>();

  for (const sheetName of CATEGORY_SHEETS) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      console.warn(`Missing sheet: ${sheetName}`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: false,
      blankrows: false,
    });

    // Guard against broken sheet ranges (e.g. Nursery sheet spanning 1M empty rows)
    const maxScan = Math.min(rows.length, 2000);
    for (let i = 0; i < maxScan; i++) {
      const row = rows[i] ?? [];
      const b = String(row[1] ?? "").trim();
      const c = String(row[2] ?? "").trim();
      const d = String(row[3] ?? "").trim();
      const e = String(row[4] ?? "").trim();
      const rrp = parseMoney(row[5]);
      const cost = parseMoney(row[6]);

      const sku = isSku(b) ? b : isSku(c) ? c : "";
      if (!sku || !e) continue;
      // Skip section headers mistaken as SKU
      if (!rrp && !cost) continue;

      const key = sku.toUpperCase();
      bySku.set(key, {
        sku: key,
        name: e.replace(/\s+/g, " ").trim(),
        notes: d || null,
        rrp,
        cost,
        category: sheetName,
      });
    }
  }

  return [...bySku.values()].sort((a, b) => a.sku.localeCompare(b.sku));
}

async function crawlWebIndex(): Promise<Map<string, WebHit>> {
  const map = new Map<string, WebHit>();
  for (let page = 1; page <= 80; page++) {
    const url = `${BASE}/products.json?limit=250&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const json = (await res.json()) as {
      products?: Array<{
        handle: string;
        title: string;
        images?: Array<{ src?: string }>;
        variants?: Array<{
          sku?: string;
          barcode?: string;
          price?: string;
          available?: boolean;
          featured_image?: { src?: string } | null;
        }>;
      }>;
    };
    const batch = json.products ?? [];
    if (!batch.length) break;

    for (const p of batch) {
      const images = p.images ?? [];
      for (const v of p.variants ?? []) {
        const sku = String(v.sku ?? "").trim().toUpperCase();
        if (!sku) continue;
        const imageUrl = v.featured_image?.src || images[0]?.src || "";
        const price = v.price != null ? Number(v.price) : null;
        map.set(sku, {
          sku,
          barcode: String(v.barcode ?? "").trim(),
          title: p.title,
          imageUrl,
          productUrl: `${BASE}/products/${p.handle}`,
          price: Number.isFinite(price) ? price : null,
          available: typeof v.available === "boolean" ? v.available : null,
        });
      }
    }
    console.log(`  web page ${page}: index size ${map.size}`);
  }
  return map;
}

async function uploadImageToSupabase(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sku: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? ".png" : ct.includes("webp") ? ".webp" : ".jpg";
    const path = `micro/${sku}${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, buf, {
      contentType: ct.includes("image/") ? ct : "image/jpeg",
      upsert: true,
    });
    if (error) {
      console.warn(`  image upload ${sku}: ${error.message}`);
      return null;
    }
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn(`  image fetch ${sku}: ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  console.log("Parsing Dropship spreadsheet SKUs…");
  const rows = parseDropship();
  console.log(`Found ${rows.length} unique SKU(s) across 5 category sheets.\n`);

  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1);
  for (const [c, n] of byCat) console.log(`  ${n}\t${c}`);

  if (dryRun) {
    console.log("\nDRY RUN — sample:");
    for (const r of rows.slice(0, 10)) {
      console.log(`  ${r.sku}\t£${r.rrp}\t£${r.cost}\t${r.name.slice(0, 40)}`);
    }
    return;
  }

  console.log("\nIndexing Micro UK website for images/EAN…");
  const web = await crawlWebIndex();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let ok = 0;
  let failed = 0;
  let withImage = 0;
  let matchedWeb = 0;
  const missingWeb: string[] = [];

  for (const r of rows) {
    const hit = web.get(r.sku);
    if (hit) matchedWeb++;
    else missingWeb.push(r.sku);

    const price = r.rrp ?? hit?.price ?? null;
    if (price == null) {
      console.warn(`SKIP ${r.sku}: no RRP`);
      failed++;
      continue;
    }

    let imageUrl: string | null = null;
    if (hit?.imageUrl) {
      const hosted = await uploadImageToSupabase(supabase, r.sku, hit.imageUrl);
      imageUrl = hosted ?? hit.imageUrl;
      if (imageUrl) withImage++;
    }

    const payload = {
      sku: r.sku,
      name: r.name,
      brand: "Micro Scooters",
      category: r.category,
      description: r.notes,
      barcode: hit?.barcode || null,
      cost_price: r.cost,
      price,
      retail_price: price,
      currency: "GBP",
      stock: 0,
      active: true,
      status: "active",
      image_url: imageUrl,
      presell_enabled: true,
      presell_quantity: 50,
      expected_arrival_month: "2026-09",
      organization_id: ORG_ID,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
    if (error) {
      console.error(`FAIL ${r.sku}:`, error.message);
      failed++;
    } else {
      ok++;
      if (ok % 25 === 0) console.log(`  upserted ${ok}/${rows.length}…`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Upserted:     ${ok}`);
  console.log(`  Failed/skip:  ${failed}`);
  console.log(`  Matched web:  ${matchedWeb}/${rows.length}`);
  console.log(`  With image:   ${withImage}`);
  if (missingWeb.length) {
    console.log(
      `  No web match (${missingWeb.length}): ${missingWeb.slice(0, 20).join(", ")}${missingWeb.length > 20 ? "…" : ""}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
