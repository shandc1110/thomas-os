/**
 * Audit storefront product images for white-background packshots vs lifestyle.
 *
 * Usage (from web/):
 *   npx tsx scripts/audit-product-image-backgrounds.ts
 *   npx tsx scripts/audit-product-image-backgrounds.ts --brand mideer
 *   npx tsx scripts/audit-product-image-backgrounds.ts --sku MD3423,MD3424,MD2419
 *
 * Does NOT process images. Classification only.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import {
  classifyImageBuffer,
  derivedPackshotPublicPath,
  sourceImageKeyFromUrl,
  type ImageBackgroundKind,
} from "../lib/products/packshot-bg";

type Row = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  image_url: string;
};

type AuditRow = {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  sourceImage: string;
  sourceKey: string;
  width: number;
  height: number;
  likelyImageType: ImageBackgroundKind;
  borderNearWhiteRatio: number;
  borderColourVariance: number;
  cornerNearWhiteCount: number;
  transparentDerivativeExists: boolean;
  derivedPath: string;
};

function parseArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  loadEnv();
  const brandFilter = parseArg("--brand");
  const skuFilter = parseArg("--sku")
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = sb
    .from("products")
    .select("id, sku, name, brand, image_url")
    .eq("assortment_status", "active")
    .not("image_url", "is", null)
    .order("sku");

  if (brandFilter) query = query.ilike("brand", `%${brandFilter}%`);

  const { data, error } = await query;
  if (error) {
    console.error(error);
    process.exit(1);
  }

  let rows = (data ?? []) as Row[];
  if (skuFilter?.length) {
    const set = new Set(skuFilter);
    rows = rows.filter((r) => set.has(r.sku.toUpperCase()));
  }

  const derivedDir = resolve(process.cwd(), "public/product-images/derived");
  const results: AuditRow[] = [];

  console.log(`Auditing ${rows.length} product images…\n`);

  for (const row of rows) {
    const sourceKey = sourceImageKeyFromUrl(row.image_url);
    const derivedPath = derivedPackshotPublicPath(sourceKey);
    const derivedAbs = join(derivedDir, `${sourceKey.replace(/\.[^.]+$/i, "")}.png`);

    try {
      const buf = await fetchBuffer(row.image_url);
      const metrics = await classifyImageBuffer(buf);
      const audit: AuditRow = {
        productId: row.id,
        sku: row.sku,
        name: row.name,
        brand: row.brand,
        sourceImage: row.image_url,
        sourceKey,
        width: metrics.width,
        height: metrics.height,
        likelyImageType: metrics.kind,
        borderNearWhiteRatio: Number(metrics.borderNearWhiteRatio.toFixed(4)),
        borderColourVariance: Number(metrics.borderColourVariance.toFixed(1)),
        cornerNearWhiteCount: metrics.cornerNearWhiteCount,
        transparentDerivativeExists: existsSync(derivedAbs),
        derivedPath,
      };
      results.push(audit);
      console.log(
        `${row.sku.padEnd(8)} ${metrics.kind.padEnd(16)} white=${audit.borderNearWhiteRatio} var=${audit.borderColourVariance} corners=${metrics.cornerNearWhiteCount} deriv=${audit.transparentDerivativeExists ? "yes" : "no"}  ${row.name.slice(0, 40)}`,
      );
    } catch (e) {
      console.error(`${row.sku} FAILED`, e instanceof Error ? e.message : e);
    }
  }

  const summary = {
    total: results.length,
    packshot_white: results.filter((r) => r.likelyImageType === "packshot_white").length,
    lifestyle: results.filter((r) => r.likelyImageType === "lifestyle").length,
    ambiguous: results.filter((r) => r.likelyImageType === "ambiguous").length,
    withDerivative: results.filter((r) => r.transparentDerivativeExists).length,
  };

  console.log("\nSummary:", summary);

  const outDir = resolve(process.cwd(), "tmp/packshot-audit");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `audit-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
