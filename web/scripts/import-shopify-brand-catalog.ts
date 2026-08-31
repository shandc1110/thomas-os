/**
 * Crawl a Shopify UK storefront and write a review workbook (GBP RRP, bundles excluded).
 *
 * Usage (from web/):
 *   npx tsx scripts/import-shopify-brand-catalog.ts
 *   npx tsx scripts/import-shopify-brand-catalog.ts letoyvan
 *   npx tsx scripts/import-shopify-brand-catalog.ts grassandair
 *   npx tsx scripts/import-shopify-brand-catalog.ts letoyvan grassandair
 *
 * Output (default: Downloads/):
 *   Le_Toy_Van_Catalog_Review.xlsx + .csv
 *   Grass_Air_Catalog_Review.xlsx + .csv
 *
 * Fill the "Sell?" column (Y/N) in Review Queue before a future DB import sprint.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import {
  dedupeRows,
  expandProductVariants,
  fetchAllShopifyProducts,
  writeCatalogReviewExports,
  type ShopifyBrandConfig,
} from "./lib/shopify-catalog-import";

const BRANDS: Record<string, ShopifyBrandConfig> = {
  letoyvan: {
    key: "letoyvan",
    baseUrl: "https://letoyvan.co.uk",
    brandName: "Le Toy Van",
    filePrefix: "Le_Toy_Van",
    currency: "GBP",
  },
  grassandair: {
    key: "grassandair",
    baseUrl: "https://www.grassandair.com",
    brandName: "Grass & Air",
    filePrefix: "Grass_Air",
    currency: "GBP",
  },
};

async function runBrand(config: ShopifyBrandConfig, outDir: string) {
  console.log(`\n=== ${config.brandName} (${config.baseUrl}) ===`);
  console.log("1) Fetching products.json…");
  const products = await fetchAllShopifyProducts(config.baseUrl);
  console.log(`   Products: ${products.length}`);

  console.log("2) Expanding variants…");
  const rawRows = expandProductVariants(config, products);
  console.log(`   Variant rows: ${rawRows.length}`);

  const { kept, removed } = dedupeRows(rawRows);
  console.log(`   After dedupe: ${kept.length} (removed ${removed})`);

  const review = kept.filter((r) => !r.excluded);
  const excluded = kept.filter((r) => r.excluded);
  console.log(`   Review queue: ${review.length}`);
  console.log(`   Excluded: ${excluded.length} (bundles: ${excluded.filter((r) => r.excludeReason === "bundle").length})`);

  console.log("3) Writing review workbook…");
  const result = writeCatalogReviewExports(config, kept, outDir);
  console.log(`   Workbook: ${result.workbookPath}`);
  console.log(`   CSV: ${result.csvPath}`);
  console.log(`   Summary: ${result.summaryPath}`);

  return result.summary;
}

async function main() {
  const args = process.argv.slice(2).map((a) => a.toLowerCase());
  const keys = args.length ? args : Object.keys(BRANDS);

  for (const key of keys) {
    if (!BRANDS[key]) {
      console.error(`Unknown brand key: ${key}. Use: ${Object.keys(BRANDS).join(", ")}`);
      process.exit(1);
    }
  }

  const outDir =
    process.env.CATALOG_IMPORT_OUT?.trim() || join(homedir(), "Downloads");

  console.log(`Output directory: ${outDir}`);

  const summaries: Record<string, unknown>[] = [];
  for (const key of keys) {
    summaries.push(await runBrand(BRANDS[key], outDir));
  }

  console.log("\n========== DONE ==========");
  for (const s of summaries) {
    console.log(
      `${s.brand}: ${s.reviewQueue} SKUs to review (${s.bundlesExcluded} bundles excluded)`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
