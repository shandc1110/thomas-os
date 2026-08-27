/**
 * Crawl Micro Scooters UK (Shopify) and write Dropship-template import workbook.
 *
 * Output:
 *   Downloads/Micro_Scooters_Product_Import.xlsx
 *   Downloads/Micro_Scooters_Import_Audit.csv
 */
import * as XLSX from "xlsx";
import { copyFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const TEMPLATE = "C:/Users/Dongchen/Downloads/Dropship 2026 (2).xlsx";
const OUT_XLSX = "C:/Users/Dongchen/Downloads/Micro_Scooters_Product_Import.xlsx";
const OUT_AUDIT = "C:/Users/Dongchen/Downloads/Micro_Scooters_Import_Audit.csv";
const BASE = "https://www.micro-scooters.co.uk";
const UA = "Mozilla/5.0 (compatible; CBC-catalog-import/1.0; +https://chosen-by-chloe.co.uk)";

const SHEET_NAMES = [
  "Mini & Maxi Micro's",
  "Nursery & Travel Range",
  "5+ Scooters",
  "Helmets",
  "Accessories",
  "Price List Scooters",
] as const;

type SheetName = (typeof SHEET_NAMES)[number];

type VariantRow = {
  productId: number;
  variantId: number;
  handle: string;
  title: string;
  productType: string;
  tags: string[];
  vendor: string;
  sku: string;
  barcode: string;
  price: number | null;
  compareAt: number | null;
  available: boolean | null;
  option1: string | null;
  option2: string | null;
  imageUrl: string;
  productUrl: string;
  bodyHtml: string;
  sheet: SheetName | "REVIEW";
  reviewReason?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function money(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return `£${n.toFixed(2)}`;
}

function parsePrice(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function fetchAllProducts(): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  for (let page = 1; page <= 80; page++) {
    const url = `${BASE}/products.json?limit=250&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`products.json page ${page}: HTTP ${res.status}`);
    const json = (await res.json()) as { products?: Record<string, unknown>[] };
    const batch = json.products ?? [];
    if (!batch.length) break;
    all.push(...batch);
    console.log(`  fetched page ${page}: +${batch.length} (total ${all.length})`);
    await sleep(120);
  }
  return all;
}

function isSparePart(blob: string, title: string, type: string): boolean {
  // Component "bundles" (brake/deck/handle bar) are still spares
  if (/\bbundle\b/i.test(title) && /\b(brake|deck|handle ?bar|axle|clamp|wheel|t-?tube|holder|screw|bolt)\b/i.test(title)) {
    return true;
  }
  // Keep complete scooter / gift-set bundles out of spare classification
  if (
    /\b(gift set|bundle)\b/i.test(title) &&
    /\b(scooter|mini micro|maxi micro|sprite|cruiser|classic|hopper|trike)\b/i.test(title)
  ) {
    return false;
  }
  if (/\b(gift set|bundle)\b/i.test(title) && !/\b(screw|bolt|axle|tube|clamp|wheel|brake|deck)\b/i.test(title)) {
    return false;
  }
  return (
    /\b(replacement|spare part|\bspare\b|screw|bolt|\bpin\b|t-tube|ttube|holder plate|lower slider|folding block|collar clamp|bearing|\baxle\b|deck screw|brake cable|fork only|linkage tube|steering link|fender with screws|push button|handlegrips|nut locking|rubber cover lock)\b/i.test(
      blob,
    ) ||
    /\(\s*single\s*\)|\(\s*pair\s*\)|sold as singles/i.test(title) ||
    /\b(wheel 80mm|front wheel|rear wheel|led front wheels)\b/i.test(title) ||
    type.includes("spare") ||
    type.includes("part") ||
    /^brake:/i.test(title.trim()) ||
    /^axle/i.test(title.trim()) ||
    /\b(maxi brake|mini brake|maxi deck|mini deck)\b/i.test(title)
  );
}

function classify(p: {
  title: string;
  productType: string;
  tags: string[];
  handle: string;
  body: string;
}): { sheet: SheetName | "REVIEW"; reason?: string } {
  const title = p.title.toLowerCase();
  const type = p.productType.toLowerCase();
  const tags = p.tags.map((t) => t.toLowerCase()).join(" ");
  const handle = p.handle.toLowerCase();
  const blob = `${title} ${type} ${tags} ${handle}`;

  // 1) Spare parts first — never force into scooter sheets
  if (isSparePart(blob, p.title, type)) {
    return { sheet: "REVIEW", reason: "spare/replacement part" };
  }

  // 2) Helmets
  if (/\bhelmet\b/.test(blob) || type.includes("helmet") || tags.includes("helmet")) {
    return { sheet: "Helmets" };
  }

  // Scooter gift/companion sets belong with scooters, not accessories
  const isScooterSet =
    /\b(scooter set|adventure set|essentials set|play & carry|on the go set)\b/i.test(title) ||
    (/\b(mini micro|maxi micro|sprite|cruiser|classic)\b/i.test(title) &&
      /\b(bell|light|basket|helmet|lock|ribbon)\b/i.test(title) &&
      /\b(set|bundle)\b/i.test(title));

  // 3) Retail accessories before scooter keyword fallback
  if (
    !isScooterSet &&
    (/\b(projector light|bottle cage|knee|elbow pads|gift set|lunch bag|carry bag|carry strap|backpack|patterned bell|scooter bell|reflector|poncho|streamer|badge|scooter lock|dual cage|flower basket|folding basket)\b/i.test(
      blob,
    ) ||
      ((/\b(bell|light|bag|lock|pad|strap|basket)\b/i.test(title) ||
        type.includes("accessor") ||
        tags.includes("accessories") ||
        tags.includes("accessory")) &&
        !/\b(mini micro|maxi micro|sprite|cruiser|classic|scooter)\b/i.test(title)))
  ) {
    return { sheet: "Accessories" };
  }

  // 4) Nursery / travel / ride-ons
  if (
    /\b(air hopper|hopper|trike|tricycle|balance bike|push along|3 in 1|4 in 1|7 in 1|mini2grow|travel bag|suitcase|luggage|nursery)\b/i.test(
      blob,
    ) ||
    type.includes("trike") ||
    type.includes("hopper") ||
    type.includes("balance") ||
    type.includes("nursery") ||
    type.includes("travel")
  ) {
    return { sheet: "Nursery & Travel Range" };
  }

  // 5) Mini & Maxi complete scooters / scooter bundles
  const isMiniMaxi =
    /\b(mini micro|maxi micro|mini deluxe|maxi deluxe|mini deluxe eco)\b/i.test(blob) ||
    /\b(scooter mini|scooter maxi|maxi foldable|mini foldable)\b/i.test(blob) ||
    type.includes("mini micro") ||
    type.includes("maxi micro") ||
    (/\b(mini|maxi)\b/i.test(type) && /\bscooter\b/i.test(blob));

  if (
    isMiniMaxi &&
    !/\b(sprite|adult|cruiser|monster|kickboard|chilli|stunt)\b/i.test(title + " " + type)
  ) {
    return { sheet: "Mini & Maxi Micro's" };
  }

  // 6) 5+ scooters
  const isFivePlus =
    /\b(sprite|cruiser|adult|monster|kickboard|speed\+|speed plus|explorer|whiteout|mobility|classic|chilli|stunt)\b/i.test(
      blob,
    ) ||
    (/\bscooter\b/i.test(blob) && !isMiniMaxi);

  if (isFivePlus) {
    if (
      /\b(bag|bell|light|pad|lock|cover|grip)\b/i.test(title) &&
      !/\bbundle\b/i.test(title) &&
      !/\b(sprite|cruiser|classic|monster|kickboard|scooter)\b/i.test(title)
    ) {
      return { sheet: "Accessories" };
    }
    return { sheet: "5+ Scooters" };
  }

  if (type.includes("accessor") || tags.includes("accessories") || tags.includes("accessory")) {
    return { sheet: "Accessories" };
  }

  return { sheet: "REVIEW", reason: "unclear category" };
}

function displayName(title: string, option1: string | null, option2: string | null): string {
  let base = title.trim().replace(/^bundle\s+/i, "").trim();
  const opts = [option1, option2]
    .map((o) => (o && o !== "Default Title" ? o.trim() : ""))
    .filter(Boolean);
  if (!opts.length) return base;
  const lower = base.toLowerCase();
  if (opts.every((o) => lower.includes(o.toLowerCase()))) return base;
  return `${base}: ${opts.join(" / ")}`;
}

function availabilityNote(available: boolean | null, compareAt: number | null, price: number | null): string {
  const notes: string[] = [];
  if (available === false) notes.push("Out of stock");
  else if (available === true) notes.push("In stock");
  if (compareAt != null && price != null && compareAt > price) notes.push("On sale");
  return notes.join("; ");
}

async function buildRows(products: Record<string, unknown>[]): Promise<VariantRow[]> {
  const rows: VariantRow[] = [];
  for (const p of products) {
    const handle = String(p.handle ?? "");
    const title = String(p.title ?? "");
    const productType = String(p.product_type ?? "");
    const tagsRaw = p.tags;
    const tags =
      typeof tagsRaw === "string"
        ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : Array.isArray(tagsRaw)
          ? tagsRaw.map(String)
          : [];
    const vendor = String(p.vendor ?? "");
    const bodyHtml = String(p.body_html ?? "");
    const images = (p.images as Array<{ src?: string }>) ?? [];
    const variants = (p.variants as Array<Record<string, unknown>>) ?? [];
    const productId = Number(p.id);

    const { sheet, reason } = classify({
      title,
      productType,
      tags,
      handle,
      body: stripHtml(bodyHtml),
    });

    for (const v of variants) {
      const sku = String(v.sku ?? "").trim();
      const barcode = String(v.barcode ?? "").trim();
      const variantId = Number(v.id);
      const option1 = v.option1 != null ? String(v.option1) : null;
      const option2 = v.option2 != null ? String(v.option2) : null;
      const price = parsePrice(v.price);
      const compareAt = parsePrice(v.compare_at_price);
      const available = typeof v.available === "boolean" ? v.available : null;

      // Prefer variant image if present
      let imageUrl = "";
      const featured = v.featured_image as { src?: string } | null;
      if (featured?.src) imageUrl = featured.src;
      else if (images[0]?.src) imageUrl = images[0].src;

      rows.push({
        productId,
        variantId,
        handle,
        title: displayName(title, option1, option2),
        productType,
        tags,
        vendor,
        sku,
        barcode,
        price,
        compareAt,
        available,
        option1,
        option2,
        imageUrl,
        productUrl: `${BASE}/products/${handle}`,
        bodyHtml,
        sheet,
        reviewReason: reason,
      });
    }
  }
  return rows;
}

function dedupe(rows: VariantRow[]): { kept: VariantRow[]; removed: number } {
  const byKey = new Map<string, VariantRow>();
  let removed = 0;
  for (const row of rows) {
    const key =
      (row.sku && `sku:${row.sku.toUpperCase()}`) ||
      (row.barcode && `ean:${row.barcode}`) ||
      `vid:${row.variantId}`;
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

function writeOrderSheet(
  wb: XLSX.WorkBook,
  sheetName: SheetName,
  products: VariantRow[],
) {
  const existing = wb.Sheets[sheetName];
  if (!existing) throw new Error(`Missing sheet ${sheetName}`);

  // Keep title rows 1-5 (0-based 0-4), rebuild from row 6
  const oldRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(existing, {
    header: 1,
    defval: null,
    raw: false,
  });

  const headerBlock = oldRows.slice(0, 5).map((r) => [...(r ?? [])]);
  // Ensure header row 5 (index 4) has column labels
  while (headerBlock.length < 5) headerBlock.push([]);
  headerBlock[4] = [
    null,
    null,
    " MODEL ",
    " NOTES ",
    " DESCRIPTION ",
    " RRP   ",
    " PRICE ",
    sheetName === "Accessories" ? " QTY " : null,
    sheetName === "Accessories" ? " Total Net  " : null,
  ];

  // Group by productType for section headers
  const byType = new Map<string, VariantRow[]>();
  for (const p of products) {
    const section = p.productType?.trim() || "Other";
    if (!byType.has(section)) byType.set(section, []);
    byType.get(section)!.push(p);
  }

  const outRows: (string | number | null)[][] = [...headerBlock];
  const sortedTypes = [...byType.keys()].sort((a, b) => a.localeCompare(b));

  for (const type of sortedTypes) {
    outRows.push([null, null, ` ${type} `, null, null, null, null]);
    const list = byType.get(type)!.sort((a, b) => a.title.localeCompare(b.title));
    for (const p of list) {
      const sku = p.sku || "";
      outRows.push([
        null,
        sku ? ` ${sku} ` : null,
        sku ? ` ${sku} ` : null,
        availabilityNote(p.available, p.compareAt, p.price) || null,
        ` ${p.title} `,
        p.price != null ? ` ${money(p.price)} ` : null,
        null, // wholesale PRICE unknown — leave blank
        null,
        null,
      ]);
    }
    outRows.push([null, null, null, null, null, null, null]); // spacer
  }

  const newSheet = XLSX.utils.aoa_to_sheet(outRows);
  // Preserve some meta from original if present
  if (existing["!merges"]) newSheet["!merges"] = existing["!merges"];
  if (existing["!cols"]) newSheet["!cols"] = existing["!cols"];
  wb.Sheets[sheetName] = newSheet;
}

function writePriceListSheet(wb: XLSX.WorkBook, scooterRows: VariantRow[]) {
  // Group by base title without colour suffix after colon
  const groups = new Map<
    string,
    { skus: string[]; colours: Set<string>; rrp: number | null }
  >();

  for (const p of scooterRows) {
    const base = p.title.includes(":")
      ? p.title.slice(0, p.title.indexOf(":")).trim()
      : p.title.trim();
    const colour =
      p.title.includes(":")
        ? p.title.slice(p.title.indexOf(":") + 1).trim()
        : p.option1 && p.option1 !== "Default Title"
          ? p.option1
          : "";
    if (!groups.has(base)) {
      groups.set(base, { skus: [], colours: new Set(), rrp: p.price });
    }
    const g = groups.get(base)!;
    if (p.sku) g.skus.push(p.sku);
    if (colour) g.colours.add(colour);
    if (g.rrp == null && p.price != null) g.rrp = p.price;
  }

  const aoa: (string | number | null)[][] = [
    [null, null, "Micro Scooter Trade Price List SS26 (imported from micro-scooters.co.uk)"],
    [],
    [],
    [null, "Item ", "Colours Available ", "RRP", "Price"],
  ];

  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, g] of sorted) {
    aoa.push([
      g.skus[0] ?? "",
      name,
      [...g.colours].sort().join(", ") || "—",
      g.rrp != null ? money(g.rrp) : "",
      "", // wholesale unknown
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  wb.Sheets["Price List Scooters"] = sheet;
}

async function main() {
  console.log("1) Loading template…");
  copyFileSync(TEMPLATE, OUT_XLSX);
  const wb = XLSX.readFile(OUT_XLSX);

  console.log("2) Crawling Micro Scooters UK catalogue…");
  const products = await fetchAllProducts();
  console.log(`   Products: ${products.length}`);

  console.log("3) Expanding variants + classifying…");
  const rawRows = await buildRows(products);
  console.log(`   Variant rows before dedupe: ${rawRows.length}`);

  const { kept, removed } = dedupe(rawRows);
  console.log(`   After dedupe: ${kept.length} (removed ${removed})`);

  const bySheet = new Map<string, VariantRow[]>();
  for (const name of [...SHEET_NAMES, "REVIEW"]) bySheet.set(name, []);
  for (const row of kept) {
    bySheet.get(row.sheet)!.push(row);
  }

  console.log("4) Writing sheets 1–5…");
  for (const name of SHEET_NAMES.slice(0, 5) as SheetName[]) {
    const list = bySheet.get(name) ?? [];
    console.log(`   ${name}: ${list.length}`);
    writeOrderSheet(wb, name, list);
  }

  console.log("5) Writing Price List Scooters summary…");
  const scooters = [
    ...(bySheet.get("Mini & Maxi Micro's") ?? []),
    ...(bySheet.get("Nursery & Travel Range") ?? []),
    ...(bySheet.get("5+ Scooters") ?? []),
  ];
  writePriceListSheet(wb, scooters);

  // Keep sheets 7+ untouched from the copied template
  XLSX.writeFile(wb, OUT_XLSX);
  console.log(`   Wrote ${OUT_XLSX}`);

  console.log("6) Writing audit CSV…");
  const review = bySheet.get("REVIEW") ?? [];
  const imported = kept.filter((r) => r.sheet !== "REVIEW");

  const auditLines = [
    [
      "SKU",
      "Product Name",
      "Category / Sheet",
      "Product URL",
      "Image URL",
      "EAN",
      "RRP",
      "Status",
      "Review Reason",
    ].join(","),
  ];

  for (const r of [...imported, ...review].sort((a, b) =>
    a.sheet.localeCompare(b.sheet) || a.title.localeCompare(b.title),
  )) {
    const status =
      r.sheet === "REVIEW"
        ? "manual_review"
        : !r.sku
          ? "imported_missing_sku"
          : !r.imageUrl
            ? "imported_missing_image"
            : !r.price
              ? "imported_missing_price"
              : "imported";
    auditLines.push(
      [
        r.sku,
        r.title,
        r.sheet,
        r.productUrl,
        r.imageUrl,
        r.barcode,
        r.price != null ? String(r.price) : "",
        status,
        r.reviewReason ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(","),
    );
  }
  writeFileSync(OUT_AUDIT, auditLines.join("\n"), "utf8");

  const missingSku = imported.filter((r) => !r.sku).length;
  const missingImage = imported.filter((r) => !r.imageUrl).length;
  const missingPrice = imported.filter((r) => r.price == null).length;

  const summary = {
    totalSkusFound: rawRows.length,
    totalSkusImported: imported.length,
    sheets: Object.fromEntries(
      SHEET_NAMES.map((n) => [
        n,
        n === "Price List Scooters"
          ? "summary regenerated from scooter sheets"
          : (bySheet.get(n) ?? []).length,
      ]),
    ),
    duplicatesRemoved: removed,
    productsRequiringManualReview: review.length,
    productsMissingSku: missingSku,
    productsMissingImage: missingImage,
    productsMissingPrice: missingPrice,
    outputs: { workbook: OUT_XLSX, audit: OUT_AUDIT },
  };

  console.log("\n========== SUMMARY ==========");
  console.log(`Total SKUs found: ${summary.totalSkusFound}`);
  console.log(`Total SKUs imported: ${summary.totalSkusImported}`);
  for (const n of SHEET_NAMES) {
    console.log(`${n}: ${summary.sheets[n]}`);
  }
  console.log(`Duplicates removed: ${summary.duplicatesRemoved}`);
  console.log(`Products requiring manual review: ${summary.productsRequiringManualReview}`);
  console.log(`Products missing SKU: ${summary.productsMissingSku}`);
  console.log(`Products missing image: ${summary.productsMissingImage}`);
  console.log(`Products missing price: ${summary.productsMissingPrice}`);
  console.log(`Workbook: ${OUT_XLSX}`);
  console.log(`Audit: ${OUT_AUDIT}`);

  writeFileSync(
    join(dirname(OUT_XLSX), "Micro_Scooters_Import_Summary.json"),
    JSON.stringify(summary, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
