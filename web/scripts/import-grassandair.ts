/**
 * Import Grass & Air UK catalogue from Shopify (GBP RRP, pre-order, variant grouping).
 *
 *   npx tsx scripts/import-grassandair.ts
 *   npx tsx scripts/import-grassandair.ts --dry
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import {
  fetchAllShopifyProducts,
  isBundleProduct,
  rrpFromVariant,
  stripHtml,
} from "./lib/shopify-catalog-import";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const BRAND = "Grass & Air";
const BASE = "https://www.grassandair.com";
const PRESell_MONTH = "2026-09";
const DEFAULT_PRESell_QTY = 50;
const dryRun = process.argv.includes("--dry");

type VariantInput = {
  sku: string;
  name: string;
  option1: string | null;
  option2: string | null;
  barcode: string | null;
  price: number;
  imageUrl: string;
};

function listingSku(handle: string): string {
  return `GA-LIST-${handle}`.slice(0, 64);
}

function variantDisplayName(title: string, option1: string | null, option2: string | null): string {
  const parts = [option1, option2]
    .filter((o) => o && o !== "Default Title")
    .map((o) => String(o).trim());
  if (!parts.length) return title;
  return `${title} — ${parts.join(" / ")}`;
}

function buildTags(
  shopifyTags: string[],
  handle: string,
  role: "listing" | "variant",
  option1: string | null,
  option2: string | null,
  variantCount?: number,
): string[] {
  const tags = [...shopifyTags, `cbc_vgroup:${handle}`, role === "listing" ? "cbc_listing" : "cbc_variant"];
  if (role === "listing" && variantCount != null) tags.push(`cbc_vcount:${variantCount}`);
  if (option1) tags.push(`cbc_opt1:${option1}`);
  if (option2) tags.push(`cbc_opt2:${option2}`);
  return tags;
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  console.log("Fetching Grass & Air catalogue…");
  const products = await fetchAllShopifyProducts(BASE);
  const sellable = products.filter(
    (p) =>
      !isBundleProduct({
        title: String(p.title ?? ""),
        handle: String(p.handle ?? ""),
        product_type: String(p.product_type ?? ""),
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      }),
  );

  console.log(`Products (excl. bundles): ${sellable.length}`);

  let parents = 0;
  let variants = 0;
  let failed = 0;

  for (const raw of sellable) {
    const title = String(raw.title ?? "").trim();
    const handle = String(raw.handle ?? "").trim();
    const productType = String(raw.product_type ?? "").trim();
    const shopifyTags = Array.isArray(raw.tags) ? (raw.tags as string[]).map(String) : [];
    const description = stripHtml(String(raw.body_html ?? "")).slice(0, 2000);
    const images = Array.isArray(raw.images)
      ? (raw.images as { src?: string; variant_ids?: number[] }[])
      : [];
    const defaultImage = images[0]?.src ?? "";

    const variantRows: VariantInput[] = [];
    const shopifyVariants = Array.isArray(raw.variants)
      ? (raw.variants as Record<string, unknown>[])
      : [];

    for (const v of shopifyVariants) {
      const sku = String(v.sku ?? "").trim();
      if (!sku) continue;
      const variantId = Number(v.id);
      const option1 = v.option1 != null ? String(v.option1).trim() : null;
      const option2 = v.option2 != null ? String(v.option2).trim() : null;
      const price = rrpFromVariant(v.price, v.compare_at_price);
      if (price == null || price <= 0) continue;

      const variantImage =
        images.find((img) => img.variant_ids?.includes(variantId))?.src ?? defaultImage;

      variantRows.push({
        sku,
        name: variantDisplayName(title, option1, option2),
        option1: option1 && option1 !== "Default Title" ? option1 : null,
        option2: option2 && option2 !== "Default Title" ? option2 : null,
        barcode: v.barcode != null ? String(v.barcode).trim() : null,
        price,
        imageUrl: variantImage,
      });
    }

    if (variantRows.length === 0) {
      console.warn(`SKIP ${handle}: no valid variants`);
      failed++;
      continue;
    }

    const variantCount = variantRows.length;
    const minPrice = Math.min(...variantRows.map((v) => v.price));
    const totalPresellQty = variantCount * DEFAULT_PRESell_QTY;
    const parentSku = listingSku(handle);

    const basePayload = {
      brand: BRAND,
      category: productType || null,
      description,
      currency: "GBP",
      stock: 0,
      active: true,
      status: "active",
      presell_enabled: true,
      presell_quantity: DEFAULT_PRESell_QTY,
      expected_arrival_month: PRESell_MONTH,
      organization_id: ORG_ID,
      updated_at: new Date().toISOString(),
    };

    if (dryRun) {
      parents++;
      variants += variantCount > 1 ? variantCount : 1;
      continue;
    }

    if (variantCount === 1) {
      const v = variantRows[0];
      const payload = {
        ...basePayload,
        sku: v.sku,
        name: title,
        barcode: v.barcode,
        price: v.price,
        retail_price: v.price,
        image_url: v.imageUrl || defaultImage,
        tags: buildTags(shopifyTags, handle, "listing", v.option1, v.option2, 1),
      };
      const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
      if (error) {
        console.error(`FAIL ${v.sku}:`, error.message);
        failed++;
      } else {
        parents++;
      }
      continue;
    }

    for (const v of variantRows) {
      const childPayload = {
        ...basePayload,
        sku: v.sku,
        name: v.name,
        barcode: v.barcode,
        price: v.price,
        retail_price: v.price,
        image_url: v.imageUrl || defaultImage,
        tags: buildTags(shopifyTags, handle, "variant", v.option1, v.option2),
      };
      const { error } = await supabase.from("products").upsert(childPayload, { onConflict: "sku" });
      if (error) {
        console.error(`FAIL variant ${v.sku}:`, error.message);
        failed++;
      } else {
        variants++;
      }
    }

    const parentPayload = {
      ...basePayload,
      sku: parentSku,
      name: title,
      barcode: null,
      price: minPrice,
      retail_price: minPrice,
      image_url: defaultImage,
      presell_quantity: totalPresellQty,
      tags: buildTags(shopifyTags, handle, "listing", null, null, variantCount),
    };
    const { error: parentErr } = await supabase
      .from("products")
      .upsert(parentPayload, { onConflict: "sku" });
    if (parentErr) {
      console.error(`FAIL parent ${parentSku}:`, parentErr.message);
      failed++;
    } else {
      parents++;
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Listing products: ${parents}`);
  console.log(`Variant SKU rows: ${variants}`);
  console.log(`Failed/skipped:   ${failed}`);
  if (dryRun) console.log("DRY RUN — no database writes.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
