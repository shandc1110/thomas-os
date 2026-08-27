/**
 * Sprint 05A — read-only catalogue intelligence audit.
 * Writes docs/catalogue-intelligence-05a.json (no DB mutations).
 *
 * Usage: npx tsx scripts/audit-catalogue-intelligence-05a.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { BRAND_REGISTRY } from "../lib/brands/registry";
import { brandSlugFromProductBrand } from "../lib/brands/match";
import { getSellableStock } from "../lib/presell";
import { buildProductSlug, productUrl } from "../lib/products/slug";
import { chosenByChloeTenant } from "../tenants/chosen-by-chloe/config";
import { loadEnv } from "./load-env";

loadEnv();

type Row = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  retail_price: number | null;
  shopify_price: number | null;
  currency: string | null;
  image_url: string | null;
  gallery_images: string[] | null;
  stock: number | null;
  presell_enabled: boolean | null;
  presell_quantity: number | null;
  active: boolean | null;
  status: string | null;
  organization_id: string | null;
};

type ReadinessFlags = {
  identity_ready: boolean;
  pricing_ready: boolean;
  image_ready: boolean;
  brand_ready: boolean;
  availability_ready: boolean;
  description_ready: boolean;
  pdp_ready: boolean;
  storefront_ready: boolean;
};

type CandidateRow = {
  productId: string;
  sku: string | null;
  productName: string;
  brand: string | null;
  brandSlug: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  sellableStock: number;
  imageReady: boolean;
  brandReady: boolean;
  priceReady: boolean;
  pdpReady: boolean;
  catalogueReadinessScore: number;
  productUrl: string;
};

function mapRow(row: Row) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    category: row.category,
    description: row.description,
    price: row.price != null ? Number(row.price) : null,
    retail_price: row.retail_price != null ? Number(row.retail_price) : null,
    shopify_price: row.shopify_price != null ? Number(row.shopify_price) : null,
    currency: row.currency,
    image_url: row.image_url,
    gallery_images: row.gallery_images ?? [],
    stock: row.stock ?? 0,
    presell_enabled: row.presell_enabled ?? false,
    presell_quantity: row.presell_quantity ?? 0,
    active: row.active ?? false,
    status: row.status,
  };
}

function scoreProduct(p: ReturnType<typeof mapRow>): { flags: ReadinessFlags; score: number } {
  const identityReady = Boolean(p.name?.trim()) && Boolean(p.sku?.trim());
  const priceReady =
    p.price != null && !Number.isNaN(Number(p.price)) && Number(p.price) > 0;
  const currencyOk = Boolean(p.currency?.trim());
  const pricingReady = priceReady && currencyOk;
  const imageReady = Boolean(p.image_url?.trim());
  const brandSlug = brandSlugFromProductBrand(p.brand);
  const brandReady = Boolean(p.brand?.trim()) && brandSlug != null;
  const sellable = getSellableStock(p);
  const availabilityReady = sellable > 0;
  const descriptionReady = Boolean(p.description?.trim());
  const pdpReady =
    Boolean(p.id) && Boolean(p.name?.trim()) && buildProductSlug(p).length > 0;

  const storefrontReady =
    identityReady && pricingReady && imageReady && brandReady && pdpReady;

  let score = 0;
  if (p.name?.trim()) score += 10;
  if (p.sku?.trim()) score += 10;
  if (pricingReady) score += 20;
  if (imageReady) score += 20;
  if (p.brand?.trim()) score += 8;
  if (brandSlug) score += 7;
  if (descriptionReady) score += 10;
  if (availabilityReady) score += 15;

  return {
    flags: {
      identity_ready: identityReady,
      pricing_ready: pricingReady,
      image_ready: imageReady,
      brand_ready: brandReady,
      availability_ready: availabilityReady,
      description_ready: descriptionReady,
      pdp_ready: pdpReady,
      storefront_ready: storefrontReady,
    },
    score,
  };
}

function suspiciousImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http")) return true;
  if (u.includes("placeholder") || u.includes("via.placeholder")) return true;
  return false;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const orgId = chosenByChloeTenant.organizationId;

  const outputPath = resolve(process.cwd(), "../docs/catalogue-intelligence-05a.json");

  if (!url || !key) {
    const payload = {
      generatedAt: new Date().toISOString(),
      dataSource: "NOT_MEASURED",
      liveAccess: false,
      error: "Live Supabase credentials unavailable (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      summary: {},
      methodology: {
        scoring: "Not applied — live catalogue not accessed.",
      },
      dataQuality: [],
      brands: [],
      categories: [],
      candidates: [],
    };
    writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    console.log("No credentials — wrote placeholder JSON.");
    return;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, name, brand, category, description, price, retail_price, shopify_price, currency, image_url, gallery_images, stock, presell_enabled, presell_quantity, active, status, organization_id",
    )
    .eq("organization_id", orgId);

  if (error) {
    const payload = {
      generatedAt: new Date().toISOString(),
      dataSource: "SUPABASE_ERROR",
      liveAccess: false,
      error: error.message,
      summary: {},
      dataQuality: [],
      brands: [],
      categories: [],
      candidates: [],
    };
    writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    console.error("Supabase error:", error.message);
    return;
  }

  const rows = (data ?? []) as Row[];
  const products = rows.map(mapRow);

  const slugSet = new Map<string, string[]>();
  for (const p of products) {
    const slug = buildProductSlug(p);
    const list = slugSet.get(slug) ?? [];
    list.push(String(p.id));
    slugSet.set(slug, list);
  }
  const slugCollisions = [...slugSet.entries()].filter(([, ids]) => ids.length > 1);

  const skuMap = new Map<string, string[]>();
  for (const p of products) {
    if (!p.sku?.trim()) continue;
    const k = p.sku.trim();
    const list = skuMap.get(k) ?? [];
    list.push(String(p.id));
    skuMap.set(k, list);
  }
  const duplicateSkus = [...skuMap.entries()].filter(([, ids]) => ids.length > 1);

  let sellableCount = 0;
  let presellOnlyCount = 0;
  let zeroStockCount = 0;
  let withImage = 0;
  let withoutImage = 0;
  let withGallery = 0;
  let singleImageOnly = 0;
  let suspiciousImages = 0;
  let withPrice = 0;
  let withoutPrice = 0;
  let withBrand = 0;
  let withoutBrand = 0;
  let unmatchedBrand = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let storefrontReadyCount = 0;
  const candidates: CandidateRow[] = [];

  const brandStats = new Map<
    string,
    {
      brand: string;
      productCount: number;
      activeCount: number;
      sellableCount: number;
      imageReadyCount: number;
      priceReadyCount: number;
      avgReadinessScore: number;
      scoreSum: number;
    }
  >();

  const categoryStats = new Map<
    string,
    { category: string; productCount: number; activeCount: number; sellableCount: number }
  >();

  const dataQualityIssues: Array<{
    issue: string;
    productCount: number;
    severity: string;
    examples: string[];
    recommendation: string;
  }> = [];

  const issueBuckets: Record<string, string[]> = {
    missing_sku: [],
    missing_image: [],
    missing_price: [],
    missing_brand: [],
    missing_category: [],
    missing_description: [],
    invalid_currency: [],
    zero_stock: [],
    inactive_product: [],
    unresolved_brand: [],
    slug_collision: [],
    suspicious_image_url: [],
  };

  for (const p of products) {
    const { flags, score } = scoreProduct(p);
    const sellable = getSellableStock(p);
    const onHand = Math.max(p.stock ?? 0, 0);
    const presell = p.presell_enabled ? Math.max(p.presell_quantity ?? 0, 0) : 0;

    if (p.active) activeCount++;
    else inactiveCount++;

    if (sellable > 0) sellableCount++;
    if (onHand <= 0 && presell > 0) presellOnlyCount++;
    if (sellable <= 0) zeroStockCount++;

    if (flags.image_ready) withImage++;
    else withoutImage++;

    const gallery = p.gallery_images ?? [];
    if (gallery.length > 0) withGallery++;
    if (flags.image_ready && gallery.length === 0) singleImageOnly++;

    if (p.image_url && suspiciousImageUrl(p.image_url)) {
      suspiciousImages++;
      if (issueBuckets.suspicious_image_url.length < 5) {
        issueBuckets.suspicious_image_url.push(p.sku ?? String(p.id));
      }
    }

    if (flags.pricing_ready) withPrice++;
    else withoutPrice++;

    if (p.brand?.trim()) withBrand++;
    else withoutBrand++;

    const brandSlug = brandSlugFromProductBrand(p.brand);
    if (p.brand?.trim() && !brandSlug) {
      unmatchedBrand++;
      if (issueBuckets.unresolved_brand.length < 5) {
        issueBuckets.unresolved_brand.push(p.brand!);
      }
    }

    if (flags.storefront_ready) storefrontReadyCount++;

    if (!p.sku?.trim() && issueBuckets.missing_sku.length < 5) {
      issueBuckets.missing_sku.push(p.sku ?? String(p.id));
    }
    if (!flags.image_ready && issueBuckets.missing_image.length < 5) {
      issueBuckets.missing_image.push(p.sku ?? String(p.id));
    }
    if (!flags.pricing_ready && issueBuckets.missing_price.length < 5) {
      issueBuckets.missing_price.push(p.sku ?? String(p.id));
    }
    if (!p.brand?.trim() && issueBuckets.missing_brand.length < 5) {
      issueBuckets.missing_brand.push(p.sku ?? String(p.id));
    }
    if (!p.category?.trim() && issueBuckets.missing_category.length < 5) {
      issueBuckets.missing_category.push(p.sku ?? String(p.id));
    }
    if (!flags.description_ready && issueBuckets.missing_description.length < 5) {
      issueBuckets.missing_description.push(p.sku ?? String(p.id));
    }
    if (!p.currency?.trim() && issueBuckets.invalid_currency.length < 5) {
      issueBuckets.invalid_currency.push(p.sku ?? String(p.id));
    }
    if (sellable <= 0 && issueBuckets.zero_stock.length < 5) {
      issueBuckets.zero_stock.push(p.sku ?? String(p.id));
    }
    if (!p.active && issueBuckets.inactive_product.length < 5) {
      issueBuckets.inactive_product.push(p.sku ?? String(p.id));
    }

    const brandKey = p.brand?.trim() || "(no brand)";
    const bs = brandStats.get(brandKey) ?? {
      brand: brandKey,
      productCount: 0,
      activeCount: 0,
      sellableCount: 0,
      imageReadyCount: 0,
      priceReadyCount: 0,
      avgReadinessScore: 0,
      scoreSum: 0,
    };
    bs.productCount++;
    bs.scoreSum += score;
    if (p.active) bs.activeCount++;
    if (sellable > 0) bs.sellableCount++;
    if (flags.image_ready) bs.imageReadyCount++;
    if (flags.pricing_ready) bs.priceReadyCount++;
    brandStats.set(brandKey, bs);

    const catKey = p.category?.trim() || "(no category)";
    const cs = categoryStats.get(catKey) ?? {
      category: catKey,
      productCount: 0,
      activeCount: 0,
      sellableCount: 0,
    };
    cs.productCount++;
    if (p.active) cs.activeCount++;
    if (sellable > 0) cs.sellableCount++;
    categoryStats.set(catKey, cs);

    const isCandidate =
      p.active &&
      flags.identity_ready &&
      flags.pricing_ready &&
      flags.image_ready &&
      flags.brand_ready &&
      flags.pdp_ready &&
      sellable > 0;

    if (isCandidate) {
      candidates.push({
        productId: String(p.id),
        sku: p.sku,
        productName: p.name,
        brand: p.brand,
        brandSlug,
        category: p.category,
        price: p.price,
        currency: p.currency,
        sellableStock: sellable,
        imageReady: flags.image_ready,
        brandReady: flags.brand_ready,
        priceReady: flags.pricing_ready,
        pdpReady: flags.pdp_ready,
        catalogueReadinessScore: score,
        productUrl: productUrl(p),
      });
    }
  }

  for (const [, ids] of slugCollisions) {
    if (issueBuckets.slug_collision.length < 5) {
      issueBuckets.slug_collision.push(ids.join(","));
    }
  }

  const countMissingSku = products.filter((p) => !p.sku?.trim()).length;
  const countMissingImage = products.filter((p) => !p.image_url?.trim()).length;
  const countMissingPrice = products.filter(
    (p) => p.price == null || Number(p.price) <= 0,
  ).length;
  const countMissingBrand = products.filter((p) => !p.brand?.trim()).length;
  const countMissingCategory = products.filter((p) => !p.category?.trim()).length;
  const countMissingDescription = products.filter((p) => !p.description?.trim()).length;
  const countInvalidCurrency = products.filter((p) => !p.currency?.trim()).length;
  const countNullSku = countMissingSku;

  const issueDefs: Array<{
    key: string;
    issue: string;
    count: number;
    severity: string;
    recommendation: string;
  }> = [
    {
      key: "missing_sku",
      issue: "Missing SKU",
      count: countMissingSku,
      severity: countMissingSku > 0 ? "high" : "low",
      recommendation: "Assign SKU before channel publish; null SKUs bypass unique index.",
    },
    {
      key: "missing_image",
      issue: "Missing primary image",
      count: countMissingImage,
      severity: countMissingImage > 0 ? "high" : "low",
      recommendation: "Run image upload/match scripts or exclude from storefront until image_url set.",
    },
    {
      key: "missing_price",
      issue: "Missing or zero price",
      count: countMissingPrice,
      severity: countMissingPrice > 0 ? "critical" : "low",
      recommendation: "Set console price before merchandising or checkout.",
    },
    {
      key: "missing_brand",
      issue: "Missing brand",
      count: countMissingBrand,
      severity: countMissingBrand > 0 ? "high" : "low",
      recommendation: "Set brand text to match BRAND_REGISTRY matchNames.",
    },
    {
      key: "unresolved_brand",
      issue: "Brand not matched to BRAND_REGISTRY",
      count: unmatchedBrand,
      severity: unmatchedBrand > 0 ? "medium" : "low",
      recommendation: "Normalise brand spelling or extend registry matchNames.",
    },
    {
      key: "missing_category",
      issue: "Missing category",
      count: countMissingCategory,
      severity: "low",
      recommendation: "Optional for Edit V1; useful for browse filters.",
    },
    {
      key: "missing_description",
      issue: "Missing description",
      count: countMissingDescription,
      severity: "low",
      recommendation: "Add description for PDP SEO; not blocking for card display.",
    },
    {
      key: "invalid_currency",
      issue: "Missing currency",
      count: countInvalidCurrency,
      severity: countInvalidCurrency > 0 ? "medium" : "low",
      recommendation: "Set explicit currency (GBP vs CNY); mapper defaults to CNY.",
    },
    {
      key: "zero_stock",
      issue: "Zero sellable stock",
      count: zeroStockCount,
      severity: "medium",
      recommendation: "Presell or receive stock before featuring as sellable candidate.",
    },
    {
      key: "inactive_product",
      issue: "Inactive product",
      count: inactiveCount,
      severity: "info",
      recommendation: "Inactive rows excluded from public catalog API.",
    },
    {
      key: "slug_collision",
      issue: "Derived slug collision",
      count: slugCollisions.length,
      severity: slugCollisions.length > 0 ? "critical" : "low",
      recommendation: "Should not occur with id suffix; investigate if > 0.",
    },
    {
      key: "suspicious_image_url",
      issue: "Suspicious image URL pattern",
      count: suspiciousImages,
      severity: suspiciousImages > 0 ? "medium" : "low",
      recommendation: "Verify Storage public URLs vs placeholders.",
    },
    {
      key: "duplicate_sku",
      issue: "Duplicate non-null SKU",
      count: duplicateSkus.length,
      severity: duplicateSkus.length > 0 ? "critical" : "low",
      recommendation: "DB unique index should prevent; reconcile if found.",
    },
  ];

  for (const def of issueDefs) {
    if (def.count === 0 && def.key !== "inactive_product") continue;
    dataQualityIssues.push({
      issue: def.issue,
      productCount: def.count,
      severity: def.severity,
      examples: issueBuckets[def.key] ?? [],
      recommendation: def.recommendation,
    });
  }

  const currencyDist: Record<string, number> = {};
  let shopifyPriceDiff = 0;
  let retailPriceDiff = 0;
  for (const p of products) {
    const c = (p.currency ?? "null").toUpperCase();
    currencyDist[c] = (currencyDist[c] ?? 0) + 1;
    if (
      p.shopify_price != null &&
      p.price != null &&
      Number(p.shopify_price) !== Number(p.price)
    ) {
      shopifyPriceDiff++;
    }
    if (
      p.retail_price != null &&
      p.price != null &&
      Number(p.retail_price) !== Number(p.price)
    ) {
      retailPriceDiff++;
    }
  }

  const brands = [...brandStats.values()]
    .map((b) => ({
      brand: b.brand,
      productCount: b.productCount,
      activeCount: b.activeCount,
      sellableCount: b.sellableCount,
      imageReadyCount: b.imageReadyCount,
      priceReadyCount: b.priceReadyCount,
      avgCatalogueReadinessScore:
        b.productCount > 0 ? Math.round(b.scoreSum / b.productCount) : 0,
    }))
    .sort((a, b) => b.productCount - a.productCount);

  const categories = [...categoryStats.values()]
    .sort((a, b) => b.productCount - a.productCount);

  const registrySlugs = BRAND_REGISTRY.map((b) => b.slug);
  const matchedBrandSlugs = new Set(
    products.map((p) => brandSlugFromProductBrand(p.brand)).filter(Boolean),
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    dataSource: "LIVE_SUPABASE",
    liveAccess: true,
    organizationId: orgId,
    table: "public.products",
    methodology: {
      scoring: {
        name: "Catalogue Readiness Score (0–100)",
        dimensions: {
          name: 10,
          sku: 10,
          validPriceAndCurrency: 20,
          primaryImage: 20,
          brandText: 8,
          brandRegistryMatch: 7,
          description: 10,
          sellableStock: 15,
        },
        note: "Analytical readiness only — not Chosen by Chloe editorial judgement.",
      },
      sellableStock: "getSellableStock() = on-hand + presell pool",
      candidateDefinition:
        "active AND identity_ready AND pricing_ready AND image_ready AND brand_ready AND pdp_ready AND sellable > 0",
      candidateLabel: "CATALOGUE-READY CANDIDATE (not Chosen by Chloe selection)",
      slugArchitecture: "Sprint 04B buildProductSlug — brand-name-id",
    },
    limitations: [
      "Image URLs not HTTP-fetched; broken links may exist undetected.",
      "No subjective product quality assessment.",
      "Tenant-scoped to Chosen by Chloe organization_id.",
    ],
    summary: {
      totalProducts: products.length,
      activeProducts: activeCount,
      inactiveProducts: inactiveCount,
      sellableProducts: sellableCount,
      presellOnlyProducts: presellOnlyCount,
      zeroSellableStockProducts: zeroStockCount,
      withPrimaryImage: withImage,
      withoutPrimaryImage: withoutImage,
      withGalleryImages: withGallery,
      singleImageOnly: singleImageOnly,
      withValidPrice: withPrice,
      withoutValidPrice: withoutPrice,
      withBrand: withBrand,
      withoutBrand: withoutBrand,
      unmatchedBrandLabels: unmatchedBrand,
      storefrontReadyProducts: storefrontReadyCount,
      catalogueReadyCandidateCount: candidates.length,
      nullSkuCount: countNullSku,
      duplicateSkuGroups: duplicateSkus.length,
      slugCollisionGroups: slugCollisions.length,
      suspiciousImageUrlCount: suspiciousImages,
      currencyDistribution: currencyDist,
      priceDiffersFromShopifyPrice: shopifyPriceDiff,
      priceDiffersFromRetailPrice: retailPriceDiff,
      brandRegistrySlugs: registrySlugs,
      brandSlugsPresentInCatalogue: [...matchedBrandSlugs],
    },
    merchandisingFields: {
      chloe_edit: "NOT_PRESENT_IN_SCHEMA",
      featured: "NOT_PRESENT_IN_SCHEMA",
      editorial_rank: "NOT_PRESENT_IN_SCHEMA",
      hero_product: "NOT_PRESENT_IN_SCHEMA",
    },
    dataQuality: dataQualityIssues,
    brands,
    categories,
    candidates: candidates.sort((a, b) => b.catalogueReadinessScore - a.catalogueReadinessScore),
  };

  writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Audit complete: ${products.length} products, ${candidates.length} candidates`);
  console.log(`Written: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
