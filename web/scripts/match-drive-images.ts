/**
 * Match PART1-style MiDeer asset folders to products and upload images.
 *
 * Selection rules (based on how CBC organises / picks shots):
 *   1. Prefer English packaging folders (英文)
 *   2. Prefer main product shots (主图) and white-background (白底)
 *   3. Prefer top-level 白底 / 800主图 files
 *   4. Avoid long detail-page slices (详情) when a main shot exists
 *
 * Uploads main → image_url and up to 2 extras → gallery_images.
 *
 * Usage (from web/):
 *   npm run match:images -- "C:\\path\\to\\PART1"
 *   npm run match:images -- "C:\\path\\to\\PART1" --dry
 *   npm run match:images -- "C:\\path\\to\\PART1" --only-missing
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, basename, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.PRODUCT_IMAGE_BUCKET ?? "product-images";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const onlyMissing = args.includes("--only-missing");
const folderArg = args.find((a) => !a.startsWith("--")) ?? "./drive-images";
const sourceDir = resolve(process.cwd(), folderArg);

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_ROLE_KEY) fail("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  fail(`Image folder not found: ${sourceDir}`);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function parseSkus(name: string): string[] {
  const upper = name.toUpperCase();
  const re = /([A-Z]{2})?(\d{3,4})/g;
  const skus = new Set<string>();
  let prefix = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(upper)) !== null) {
    if (match[1]) prefix = match[1];
    if (!prefix) continue;
    skus.add(`${prefix}${match[2]}`);
  }
  return [...skus];
}

function walkImages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkImages(full));
    else if (CONTENT_TYPES[extname(entry.name).toLowerCase()]) out.push(full);
  }
  return out;
}

/** Lower score = better pick for UK console / packing. */
function scoreImage(file: string): number {
  const path = file.replace(/\\/g, "/");
  const name = basename(file);
  let score = 50;

  if (path.includes("英文")) score -= 40;
  else if (path.includes("无字")) score -= 15;

  if (path.includes("主图") || name.includes("主图")) score -= 30;
  if (path.includes("白底") || name.includes("白底")) score -= 25;
  if (/800.?主图|主图-?1|800主图/i.test(name)) score -= 15;
  if (/^750白底|^白底|^800x/i.test(name)) score -= 12;
  if (/(^|[^0-9])0*1\.[a-z0-9]+$/i.test(name)) score -= 8;

  if (path.includes("详情")) score += 35;
  if (path.includes("切片")) score += 25;
  if (path.includes("素材")) score += 10;
  if (path.includes("790") && !path.includes("主图")) score += 5;
  if (/\.mp4$/i.test(name)) score += 100;

  return score;
}

function pickBest(files: string[], count: number): string[] {
  const ranked = [...files]
    .filter((f) => !/\.mp4$/i.test(f))
    .sort((a, b) => scoreImage(a) - scoreImage(b) || basename(a).localeCompare(basename(b)));

  const picked: string[] = [];
  for (const file of ranked) {
    if (picked.length >= count) break;
    // Prefer diversity: don't take three near-identical 790 detail frames if possible
    const base = basename(file).replace(/_\d+\./, ".");
    if (picked.some((p) => basename(p).replace(/_\d+\./, ".") === base) && picked.length > 0) {
      continue;
    }
    picked.push(file);
  }
  // If diversity filter left us short, fill from ranked
  for (const file of ranked) {
    if (picked.length >= count) break;
    if (!picked.includes(file)) picked.push(file);
  }
  return picked;
}

async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) {
    fail(`Could not create bucket "${BUCKET}": ${error.message}`);
  }
}

async function uploadFile(sku: string, imagePath: string, slot: number): Promise<string | null> {
  const ext = extname(imagePath).toLowerCase();
  const objectPath = `${sku}${slot === 1 ? "" : `-${slot}`}${ext}`;
  if (dryRun) return `dry://${objectPath}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, readFileSync(imagePath), {
    contentType: CONTENT_TYPES[ext],
    upsert: true,
  });
  if (error) {
    console.warn(`  ⚠ ${sku} slot ${slot}: ${error.message}`);
    return null;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return publicUrl;
}

async function run(): Promise<void> {
  if (!dryRun) await ensureBucket();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, sku, image_url")
    .not("sku", "is", null);
  if (error) fail(error.message);

  const knownSkus = new Map<string, { id: string; sku: string; image_url: string | null }>();
  for (const row of products ?? []) {
    if (!row.sku) continue;
    knownSkus.set(String(row.sku).toUpperCase(), {
      id: String(row.id),
      sku: String(row.sku),
      image_url: (row.image_url as string | null) ?? null,
    });
  }

  console.log(`• Loaded ${knownSkus.size} product SKU(s).`);
  console.log(`• Source: ${sourceDir}`);
  if (onlyMissing) console.log("• Mode: only products still missing image_url");
  if (dryRun) console.log("• DRY RUN\n");

  /** sku → candidate image paths (from matching folders) */
  const candidates = new Map<string, string[]>();

  function addCandidates(sku: string, files: string[]) {
    const key = sku.toUpperCase();
    if (!knownSkus.has(key)) return;
    candidates.set(key, [...(candidates.get(key) ?? []), ...files]);
  }

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const full = join(sourceDir, entry.name);

    // Special case: 进阶拼图 has per-SKU subfolders
    if (entry.isDirectory() && entry.name.includes("进阶拼图")) {
      for (const sub of readdirSync(full, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const skus = parseSkus(sub.name).filter((s) => knownSkus.has(s));
        const images = walkImages(join(full, sub.name));
        for (const sku of skus) addCandidates(sku, images);
      }
      continue;
    }

    if (entry.isDirectory()) {
      const skus = parseSkus(entry.name).filter((s) => knownSkus.has(s));
      const images = walkImages(full);
      if (skus.length === 0) {
        // Still try filename SKUs inside
        for (const img of images) {
          for (const sku of parseSkus(basename(img))) addCandidates(sku, [img]);
        }
        continue;
      }
      for (const sku of skus) addCandidates(sku, images);
      continue;
    }

    if (CONTENT_TYPES[extname(entry.name).toLowerCase()]) {
      for (const sku of parseSkus(basename(entry.name, extname(entry.name)))) {
        addCandidates(sku, [full]);
      }
    }
  }

  let linked = 0;
  let skipped = 0;

  for (const [skuKey, files] of [...candidates.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const product = knownSkus.get(skuKey)!;
    if (onlyMissing && product.image_url) {
      skipped++;
      continue;
    }

    const unique = [...new Set(files)];
    const best = pickBest(unique, 3);
    if (best.length === 0) continue;

    const urls: string[] = [];
    for (let i = 0; i < best.length; i++) {
      const url = await uploadFile(product.sku, best[i], i + 1);
      if (url) urls.push(url);
    }
    if (urls.length === 0) continue;

    const main = urls[0];
    const gallery = urls.slice(1);

    console.log(
      `  ✓ ${product.sku.padEnd(12)} ← ${basename(best[0])}${gallery.length ? ` +${gallery.length} gallery` : ""}  [${best.map((b) => (b.includes("英文") ? "EN" : b.includes("无字") ? "blank" : "other")).join(",")}]`,
    );

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ image_url: main, gallery_images: gallery })
        .eq("id", product.id);
      if (updateError) {
        console.warn(`  ⚠ ${product.sku}: ${updateError.message}`);
        continue;
      }
    }
    linked++;
  }

  console.log(`\nDone. Linked ${linked} product(s)${dryRun ? " (dry)" : ""}.`);
  if (skipped) console.log(`Skipped ${skipped} already-imaged product(s) (--only-missing).`);

  const stillMissing = [...knownSkus.values()]
    .filter((p) => {
      if (candidates.has(p.sku.toUpperCase()) && !(onlyMissing && p.image_url)) return false;
      return !p.image_url && !candidates.has(p.sku.toUpperCase());
    })
    .map((p) => p.sku);
  // Recompute missing after run for reporting
  if (!dryRun) {
    const { data: after } = await supabase.from("products").select("sku, image_url").not("sku", "is", null);
    const miss = (after ?? []).filter((p) => !p.image_url).map((p) => p.sku);
    if (miss.length) console.log(`\nStill without image (${miss.length}): ${miss.join(", ")}`);
  } else if (stillMissing.length) {
    console.log(`\nNo PART1 match for: ${stillMissing.join(", ")}`);
  }
}

run().catch((e) => fail(e instanceof Error ? e.message : String(e)));
