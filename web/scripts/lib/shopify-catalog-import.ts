/**
 * Shared helpers for crawling Shopify storefront catalogues into review workbooks.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

export const UA =
  "Mozilla/5.0 (compatible; CBC-catalog-import/1.0; +https://chosen-by-chloe.co.uk)";

export type ShopifyBrandConfig = {
  key: string;
  baseUrl: string;
  brandName: string;
  filePrefix: string;
  currency: "GBP";
};

export type CatalogVariantRow = {
  brand: string;
  sku: string;
  barcode: string;
  title: string;
  variantTitle: string;
  productType: string;
  tags: string[];
  rrp: number | null;
  available: boolean;
  imageUrl: string;
  productUrl: string;
  description: string;
  excluded: boolean;
  excludeReason: string;
};

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePrice(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** UK storefront RRP: compare_at when set, otherwise current price. */
export function rrpFromVariant(price: unknown, compareAt: unknown): number | null {
  const sale = parsePrice(price);
  const compare = parsePrice(compareAt);
  if (compare != null && compare > 0) return compare;
  return sale;
}

export function isBundleProduct(product: {
  title: string;
  handle: string;
  product_type: string;
  tags: string[];
}): boolean {
  const title = product.title.toLowerCase();
  const handle = product.handle.toLowerCase();
  const type = (product.product_type || "").toLowerCase();
  const tags = (product.tags || []).map((t) => t.toLowerCase());

  if (/\bbundle\b/.test(title)) return true;
  if (/\bbundle\b/.test(type)) return true;
  if (tags.some((t) => t === "bundle" || t === "bundles" || /\bbundle\b/.test(t))) return true;
  if (/-bundle$/.test(handle) || handle.includes("-bundle-") || handle.startsWith("bundle-")) {
    return true;
  }
  return false;
}

export async function fetchAllShopifyProducts(baseUrl: string): Promise<Record<string, unknown>[]> {
  const base = baseUrl.replace(/\/$/, "");
  const all: Record<string, unknown>[] = [];

  for (let page = 1; page <= 80; page++) {
    const url = `${base}/products.json?limit=250&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const json = (await res.json()) as { products?: Record<string, unknown>[] };
    const batch = json.products ?? [];
    if (!batch.length) break;
    all.push(...batch);
    console.log(`  page ${page}: +${batch.length} (total ${all.length})`);
    await sleep(120);
  }

  return all;
}

export function expandProductVariants(
  config: ShopifyBrandConfig,
  products: Record<string, unknown>[],
): CatalogVariantRow[] {
  const rows: CatalogVariantRow[] = [];

  for (const raw of products) {
    const title = String(raw.title ?? "").trim();
    const handle = String(raw.handle ?? "").trim();
    const productType = String(raw.product_type ?? "").trim();
    const tags = Array.isArray(raw.tags)
      ? (raw.tags as string[]).map((t) => String(t).trim()).filter(Boolean)
      : [];
    const bodyHtml = String(raw.body_html ?? "");
    const description = stripHtml(bodyHtml).slice(0, 500);
    const bundle = isBundleProduct({ title, handle, product_type: productType, tags });

    const images = Array.isArray(raw.images)
      ? (raw.images as { src?: string; variant_ids?: number[] }[])
      : [];
    const defaultImage = images[0]?.src ?? "";

    const variants = Array.isArray(raw.variants)
      ? (raw.variants as Record<string, unknown>[])
      : [];

    for (const variant of variants) {
      const variantId = Number(variant.id);
      const variantTitle = String(variant.title ?? "Default Title").trim();
      const sku = String(variant.sku ?? "").trim();
      const barcode = String(variant.barcode ?? "").trim();
      const option1 = variant.option1 != null ? String(variant.option1).trim() : "";
      const option2 = variant.option2 != null ? String(variant.option2).trim() : "";
      const optionParts = [option1, option2]
        .filter((o) => o && o !== "Default Title")
        .join(" / ");

      const displayTitle =
        optionParts && variantTitle !== "Default Title"
          ? `${title} — ${optionParts}`
          : title;

      const variantImage =
        images.find((img) => img.variant_ids?.includes(variantId))?.src ?? defaultImage;

      const rrp = rrpFromVariant(variant.price, variant.compare_at_price);
      const available = Boolean(variant.available);

      let excludeReason = "";
      if (bundle) excludeReason = "bundle";
      else if (!sku) excludeReason = "missing_sku";
      else if (rrp == null || rrp <= 0) excludeReason = "missing_rrp";

      rows.push({
        brand: config.brandName,
        sku,
        barcode,
        title: displayTitle,
        variantTitle,
        productType,
        tags,
        rrp,
        available,
        imageUrl: variantImage,
        productUrl: `${config.baseUrl.replace(/\/$/, "")}/products/${handle}`,
        description,
        excluded: excludeReason !== "",
        excludeReason,
      });
    }
  }

  return rows;
}

export function dedupeRows(rows: CatalogVariantRow[]): { kept: CatalogVariantRow[]; removed: number } {
  const byKey = new Map<string, CatalogVariantRow>();
  let removed = 0;

  for (const row of rows) {
    const key =
      (row.sku && `sku:${row.sku.toUpperCase()}`) ||
      (row.barcode && `ean:${row.barcode}`) ||
      `title:${row.title.toLowerCase()}`;
    if (byKey.has(key)) {
      removed++;
      continue;
    }
    byKey.set(key, row);
  }

  return { kept: [...byKey.values()], removed };
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type CatalogExportResult = {
  workbookPath: string;
  csvPath: string;
  summaryPath: string;
  summary: Record<string, unknown>;
};

export function writeCatalogReviewExports(
  config: ShopifyBrandConfig,
  rows: CatalogVariantRow[],
  outDir: string,
): CatalogExportResult {
  mkdirSync(outDir, { recursive: true });

  const reviewRows = rows.filter((r) => !r.excluded);
  const excludedRows = rows.filter((r) => r.excluded);

  const headers = [
    "Sell?",
    "SKU",
    "Product Name",
    "Category",
    "RRP GBP",
    "In Stock Online",
    "Barcode",
    "Product URL",
    "Image URL",
    "Tags",
    "Description",
    "Exclude Reason",
  ];

  const toAoA = (list: CatalogVariantRow[], includeSell = true) => {
    const aoa: (string | number | null)[][] = [headers];
    for (const r of list.sort((a, b) => a.title.localeCompare(b.title))) {
      aoa.push([
        includeSell && !r.excluded ? "" : null,
        r.sku,
        r.title,
        r.productType,
        r.rrp != null ? r.rrp : "",
        r.available ? "Y" : "N",
        r.barcode,
        r.productUrl,
        r.imageUrl,
        r.tags.join(", "),
        r.description,
        r.excludeReason,
      ]);
    }
    return aoa;
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(toAoA(reviewRows)),
    "Review Queue",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(toAoA(excludedRows, false)),
    "Excluded",
  );

  const summaryAoA = [
    ["Metric", "Value"],
    ["Brand", config.brandName],
    ["Source", config.baseUrl],
    ["Currency", config.currency],
    ["Total variant rows", rows.length],
    ["Review queue (non-bundle)", reviewRows.length],
    ["Excluded (bundles + data gaps)", excludedRows.length],
    ["Bundles excluded", excludedRows.filter((r) => r.excludeReason === "bundle").length],
    ["Missing SKU", excludedRows.filter((r) => r.excludeReason === "missing_sku").length],
    ["Missing RRP", excludedRows.filter((r) => r.excludeReason === "missing_rrp").length],
    ["In stock online", reviewRows.filter((r) => r.available).length],
    [
      "RRP range GBP",
      reviewRows.length
        ? `£${Math.min(...reviewRows.map((r) => r.rrp ?? 0)).toFixed(2)} – £${Math.max(...reviewRows.map((r) => r.rrp ?? 0)).toFixed(2)}`
        : "—",
    ],
    ["", ""],
    ["Instructions", "Set Sell? to Y or N in Review Queue, then import approved rows."],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoA), "Summary");

  const workbookPath = join(outDir, `${config.filePrefix}_Catalog_Review.xlsx`);
  const csvPath = join(outDir, `${config.filePrefix}_Catalog_Review.csv`);
  const summaryPath = join(outDir, `${config.filePrefix}_Catalog_Summary.json`);

  XLSX.writeFile(wb, workbookPath);

  const csvLines = [
    headers.join(","),
    ...reviewRows.map((r) =>
      [
        "",
        r.sku,
        r.title,
        r.productType,
        r.rrp != null ? String(r.rrp) : "",
        r.available ? "Y" : "N",
        r.barcode,
        r.productUrl,
        r.imageUrl,
        r.tags.join(", "),
        r.description,
        r.excludeReason,
      ]
        .map((c) => csvEscape(String(c)))
        .join(","),
    ),
  ];
  writeFileSync(csvPath, csvLines.join("\n"), "utf8");

  const summary = {
    brand: config.brandName,
    source: config.baseUrl,
    currency: config.currency,
    totalVariantRows: rows.length,
    reviewQueue: reviewRows.length,
    excluded: excludedRows.length,
    bundlesExcluded: excludedRows.filter((r) => r.excludeReason === "bundle").length,
    inStockOnline: reviewRows.filter((r) => r.available).length,
    outputs: { workbook: workbookPath, csv: csvPath },
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  return { workbookPath, csvPath, summaryPath, summary };
}

export function defaultOutputDir(): string {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (home) return join(home, "Downloads");
  return join(process.cwd(), "scripts", "output");
}
