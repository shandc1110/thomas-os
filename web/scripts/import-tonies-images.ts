/**
 * Fetch Tonies product images from tonies.com/en-gb and upload to Supabase.
 *
 * Matches by salesId (= our sku) or gtin (= our barcode).
 * Prefers Square_1_1 product shot for image_url; optional gallery Squares.
 *
 * Usage (from web/):
 *   npx tsx scripts/import-tonies-images.ts
 *   npx tsx scripts/import-tonies-images.ts --dry
 *   npx tsx scripts/import-tonies-images.ts --only-missing
 *   npx tsx scripts/import-tonies-images.ts --limit 20
 *   npx tsx scripts/import-tonies-images.ts --concurrency 4
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PRODUCT_IMAGE_BUCKET ?? "product-images";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const onlyMissing = args.includes("--only-missing") || !args.includes("--all");
const concurrency = Number(argValue("--concurrency") ?? "4");
const limit = Number(argValue("--limit") ?? "0");
const delayMs = Number(argValue("--delay") ?? "150");

function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  return undefined;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "your-service-role-key") {
  fail("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type DbProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  image_url: string | null;
  name: string | null;
};

type ToniesProduct = {
  salesId?: string;
  sku?: string;
  gtin?: string;
  name?: string;
  image?: { src?: string; alt?: string };
  images?: Array<{ src?: string; url?: string; type?: string } | string>;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) {
    fail(`Could not create bucket "${BUCKET}": ${error.message}`);
  }
}

async function fetchEnGbProductUrls(): Promise<string[]> {
  const indexRes = await fetch("https://tonies.com/sitemap.xml", {
    headers: { "User-Agent": UA },
  });
  if (!indexRes.ok) fail(`sitemap index HTTP ${indexRes.status}`);
  const indexXml = await indexRes.text();
  const sitemaps = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => /tonies\.com\/sitemap_products_/i.test(u));

  const urls: string[] = [];
  for (const sm of sitemaps) {
    const res = await fetch(sm, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.warn(`  ⚠ sitemap ${sm} → HTTP ${res.status}`);
      continue;
    }
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const u = m[1];
      if (u.includes("/en-gb/") && !u.includes("/blog/")) urls.push(u);
    }
  }
  return [...new Set(urls)];
}

function extractNextProduct(html: string): ToniesProduct | null {
  const marker = '<script id="__NEXT_DATA__"';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = html.indexOf(">", start) + 1;
  const end = html.indexOf("</script>", jsonStart);
  if (end < 0) return null;
  try {
    const data = JSON.parse(html.slice(jsonStart, end));
    return (data?.props?.pageProps?.product as ToniesProduct) ?? null;
  } catch {
    return null;
  }
}

function imageUrls(product: ToniesProduct): string[] {
  const out: string[] = [];
  const push = (u?: string) => {
    if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  push(product.image?.src);
  for (const img of product.images ?? []) {
    if (typeof img === "string") push(img);
    else push(img?.src ?? img?.url);
  }
  return out;
}

/** Prefer Square_1_1, then main image.src, then any Square, then anything commercetools. */
function pickMainAndGallery(urls: string[]): { main: string | null; gallery: string[] } {
  const ct = urls.filter((u) => /commercetools\.com/i.test(u) || /cloudinary\.com\/tonies/i.test(u));
  const pool = ct.length ? ct : urls;
  const square1 = pool.find((u) => /_Square_1_1/i.test(u));
  const squares = pool.filter((u) => /_Square_/i.test(u));
  const transparent = pool.find((u) => /_Transparent/i.test(u));
  const main = square1 ?? pool[0] ?? transparent ?? null;
  if (!main) return { main: null, gallery: [] };
  const gallery = squares.filter((u) => u !== main).slice(0, 2);
  return { main, gallery };
}

function extFromUrl(url: string): { ext: string; contentType: string } {
  const path = url.split("?")[0]!.toLowerCase();
  if (path.endsWith(".png")) return { ext: ".png", contentType: "image/png" };
  if (path.endsWith(".webp")) return { ext: ".webp", contentType: "image/webp" };
  if (path.endsWith(".gif")) return { ext: ".gif", contentType: "image/gif" };
  return { ext: ".jpg", contentType: "image/jpeg" };
}

async function download(url: string): Promise<Buffer> {
  // Prefer raw commercetools URL over cloudinary wrapper when nested
  const nested = url.match(
    /https:\/\/images\.cdn\.europe-west1\.gcp\.commercetools\.com\/[^\s"'\\]+/i,
  );
  const fetchUrl = nested ? nested[0]! : url;
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": UA, Accept: "image/*,*/*" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadBuffer(
  sku: string,
  buf: Buffer,
  slot: number,
  sourceUrl: string,
): Promise<string | null> {
  const { ext, contentType } = extFromUrl(sourceUrl);
  const objectPath = `${sku}${slot === 1 ? "" : `-${slot}`}${ext}`;
  if (dryRun) return `dry://${objectPath}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.warn(`  ⚠ upload ${sku} slot ${slot}: ${error.message}`);
    return null;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return publicUrl;
}

async function fetchProductPage(url: string): Promise<ToniesProduct | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-GB,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();
  return extractNextProduct(html);
}

async function mapPool<T, R>(
  items: T[],
  size: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
      if (delayMs > 0) await sleep(delayMs);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, size) }, () => worker()));
  return results;
}

async function run() {
  if (!dryRun) await ensureBucket();

  console.log("• Loading Tonies products from Supabase…");
  const { data: rows, error } = await supabase
    .from("products")
    .select("id, sku, barcode, image_url, name")
    .ilike("brand", "%tonies%")
    .not("sku", "is", null);
  if (error) fail(error.message);

  let products = (rows ?? []) as DbProduct[];
  if (onlyMissing) products = products.filter((p) => !p.image_url);
  if (limit > 0) products = products.slice(0, limit);

  const bySku = new Map<string, DbProduct>();
  const byGtin = new Map<string, DbProduct>();
  for (const p of products) {
    bySku.set(String(p.sku).trim(), p);
    if (p.barcode) byGtin.set(String(p.barcode).trim(), p);
  }

  console.log(`• Target products: ${products.length} (only-missing=${onlyMissing})`);
  if (dryRun) console.log("• DRY RUN — no uploads");
  console.log("• Fetching en-GB product URLs from Tonies sitemap…");

  const urls = await fetchEnGbProductUrls();
  console.log(`• en-GB product pages: ${urls.length}`);
  console.log(`• Concurrency ${concurrency}, delay ${delayMs}ms\n`);

  let matched = 0;
  let updated = 0;
  let failed = 0;
  const seenIds = new Set<string>();

  await mapPool(urls, concurrency, async (url, index) => {
    if (seenIds.size >= bySku.size && bySku.size > 0) return;

    let product: ToniesProduct | null = null;
    try {
      product = await fetchProductPage(url);
    } catch (e) {
      failed++;
      if (index < 5) console.warn(`  ⚠ fetch ${url}: ${(e as Error).message}`);
      return;
    }
    if (!product) return;

    const salesId = String(product.salesId ?? "").trim();
    // gtin may arrive as a number from JSON
    const gtin = product.gtin != null ? String(product.gtin).trim() : "";
    const db =
      (salesId && bySku.get(salesId)) ||
      (gtin && byGtin.get(gtin)) ||
      null;
    if (!db) return;
    if (seenIds.has(db.id)) return;
    seenIds.add(db.id);
    matched++;

    const { main, gallery } = pickMainAndGallery(imageUrls(product));
    if (!main) {
      console.warn(`  ⚠ ${db.sku} ${db.name}: no image on page`);
      return;
    }

    try {
      const mainBuf = await download(main);
      const mainUrl = await uploadBuffer(db.sku, mainBuf, 1, main);
      if (!mainUrl) {
        failed++;
        return;
      }

      const galleryUrls: string[] = [];
      for (let i = 0; i < gallery.length; i++) {
        const gUrl = gallery[i]!;
        const buf = await download(gUrl);
        const pub = await uploadBuffer(db.sku, buf, i + 2, gUrl);
        if (pub) galleryUrls.push(pub);
      }

      if (!dryRun) {
        const patch: { image_url: string; gallery_images?: string[] } = {
          image_url: mainUrl,
        };
        if (galleryUrls.length) patch.gallery_images = galleryUrls;
        const { error: upErr } = await supabase.from("products").update(patch).eq("id", db.id);
        if (upErr) {
          console.warn(`  ⚠ DB ${db.sku}: ${upErr.message}`);
          failed++;
          return;
        }
      }

      updated++;
      console.log(
        `  ✓ ${db.sku}  ${product.name ?? db.name ?? ""}  ← ${main.split("/").pop()}`,
      );
    } catch (e) {
      failed++;
      console.warn(`  ⚠ ${db.sku}: ${(e as Error).message}`);
    }
  });

  const stillMissing = products.filter((p) => !seenIds.has(p.id));
  console.log(`\nDone.`);
  console.log(`  Matched pages: ${matched}`);
  console.log(`  Updated:       ${updated}`);
  console.log(`  Failed:        ${failed}`);
  console.log(`  Still missing: ${stillMissing.length}`);
  if (stillMissing.length && stillMissing.length <= 40) {
    for (const p of stillMissing) {
      console.log(`    - ${p.sku}\t${p.barcode ?? ""}\t${p.name ?? ""}`);
    }
  } else if (stillMissing.length > 40) {
    for (const p of stillMissing.slice(0, 25)) {
      console.log(`    - ${p.sku}\t${p.barcode ?? ""}\t${p.name ?? ""}`);
    }
    console.log(`    … +${stillMissing.length - 25} more`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
