/**
 * Controlled Joybuy first-product run for CT7013 / mideer BODY MAGNET only.
 *
 *   npx tsx scripts/joybuy-ct7013-first-product.ts
 *
 * Pre-release only. Does not invent shopId/brandId/categoryId/scene.
 * Does not call production. Does not modify public.products.
 * Makes at most ONE product-schema HTTP call.
 */
import { createClient } from "@supabase/supabase-js";
import type { Product } from "../lib/types";
import {
  assertJoybuyCredentialPresence,
  assertJoybuyFirstProductPrerequisites,
  CT7013_BRAND_NAME,
  CT7013_INTERNAL_PRODUCT_ID,
  CT7013_SKU,
  getJoybuyMerchantConfigFromEnv,
  JOYBUY_PRE_RELEASE_API_BASE_URL,
} from "../lib/integrations/joybuy/merchant-config";
import { buildCt7013ProductSchemaComponents } from "../lib/integrations/joybuy/product-schema";
import { loadEnv } from "./load-env";

loadEnv();

function apiBaseHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "INVALID";
  }
}

async function main() {
  const merchant = getJoybuyMerchantConfigFromEnv();
  const prereq = assertJoybuyFirstProductPrerequisites(merchant);
  const credentials = assertJoybuyCredentialPresence();

  console.log("=== Joybuy CT7013 first-product (controlled, pre-release) ===");
  console.log(
    JSON.stringify(
      {
        productId: CT7013_INTERNAL_PRODUCT_ID,
        sku: CT7013_SKU,
        merchantSafe: {
          shopId: merchant.shopId,
          scene: merchant.scene,
          mideerBrandId: merchant.mideerBrandId,
          ct7013CategoryId: merchant.ct7013CategoryId,
          ct7013ListPriceGbp: merchant.ct7013ListPriceGbp,
          mediaMode: merchant.mediaMode,
          apiBaseHost: apiBaseHost(merchant.apiBaseUrl),
          preReleaseOnly: merchant.preReleaseOnly,
          expectedApiBase: JOYBUY_PRE_RELEASE_API_BASE_URL,
        },
        credentialPresence: {
          appKey: !credentials.some((i) => i.code === "MISSING_APP_KEY"),
          appSecret: !credentials.some((i) => i.code === "MISSING_APP_SECRET"),
          accessToken: !credentials.some((i) => i.code === "MISSING_ACCESS_TOKEN"),
          requestBizId: !credentials.some((i) => i.code === "MISSING_REQUEST_BIZ_ID"),
        },
        prerequisiteIssues: prereq,
        credentialIssues: credentials,
      },
      null,
      2,
    ),
  );

  if (merchant.apiBaseUrl && merchant.apiBaseUrl !== JOYBUY_PRE_RELEASE_API_BASE_URL) {
    console.log("\n=== STOPPED (not pre-release) ===");
    console.log("API call made: false");
    console.log("Reason: JOYBUY_API_BASE_URL is not https://api-pre.joybuy.com/rest");
    process.exit(2);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: product, error } = await sb
    .from("products")
    .select("*")
    .eq("id", CT7013_INTERNAL_PRODUCT_ID)
    .single();

  if (error || !product) {
    console.error("Failed to load CT7013 product:", error?.message);
    process.exit(1);
  }

  const p = product as Product;
  const productOk =
    p.name === "mideer BODY MAGNET" &&
    p.brand === CT7013_BRAND_NAME &&
    (p.sku ?? "") === CT7013_SKU &&
    p.assortment_status === "active";

  console.log("\n=== PRODUCT VERIFICATION ===");
  console.log(
    JSON.stringify(
      {
        id: p.id,
        name: p.name,
        brand: p.brand,
        sku: p.sku,
        assortment_status: p.assortment_status,
        matched: productOk,
      },
      null,
      2,
    ),
  );

  if (!productOk) {
    console.log("\n=== STOPPED (product mismatch) ===");
    console.log("API call made: false");
    process.exit(2);
  }

  if (prereq.length > 0 || credentials.length > 0) {
    console.log("\n=== STOPPED (fail closed) ===");
    console.log("API call made: false");
    console.log(
      "Reason: Missing Joybuy prerequisites or credentials. No product-schema call was made.",
    );
    process.exit(2);
  }

  const built = buildCt7013ProductSchemaComponents(p, merchant);
  if (!built.ok) {
    console.log("\n=== STOPPED (schema blockers) ===", built.blockers);
    process.exit(2);
  }

  console.log("\n=== SCHEMA PREVIEW (sanitized) ===");
  console.log(
    JSON.stringify(
      {
        shopId: built.request.shopId,
        categoryId: built.request.categoryId ?? null,
        scene: built.request.scene ?? null,
        productId: null,
        components: built.components,
      },
      null,
      2,
    ),
  );

  const { runCt7013FirstProductIntegration } = await import(
    "../lib/integrations/joybuy/first-product"
  );
  const result = await runCt7013FirstProductIntegration(sb, p, {
    merchant,
    executeApi: true,
  });

  console.log("\n=== RESULT ===");
  console.log(
    JSON.stringify(
      {
        stopped: result.stopped,
        apiCallMade: result.apiCallMade,
        brandValidationSkipped: result.brandValidationSkipped,
        stopReason: result.stopReason,
        httpStatus: result.httpStatus ?? null,
        joybuySuccess: result.joybuySuccess ?? null,
        errorList: result.errorList ?? [],
        requestId: result.requestId ?? null,
        createResponse: result.createResponse ?? null,
        persistedMapping: result.persistedMapping ?? null,
      },
      null,
      2,
    ),
  );

  if (result.stopped) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
