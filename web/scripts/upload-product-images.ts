/**
 * Upload product images to Supabase Storage and link them to products by SKU.
 *
 * Usage (run from the `web` folder):
 *   npm run upload:images                 # reads ./product-images
 *   npm run upload:images -- ./my-folder  # reads a custom folder
 *
 * Naming (per SKU):
 *   CT0610.jpg      → main image (image_url) — NO underscore/dash number
 *   CT0610_1.jpg    → gallery (not main)
 *   CT0610_2.jpg    → gallery
 *   CT0610_3.jpg    → gallery
 *
 * Also accepted: CT0610-1.jpg / CT0610-2.jpg
 * Packing slip shows up to 3 images (main + gallery).
 *
 * Supported extensions: .jpg .jpeg .png .webp .gif .avif
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, basename, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PRODUCT_IMAGE_BUCKET ?? "product-images";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === "your-service-role-key") {
  fail(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "  Get it from Supabase → Project Settings → API → service_role (secret).",
  );
}

const folderArg = process.argv[2] ?? "./product-images";
const folder = resolve(process.cwd(), folderArg);

if (!existsSync(folder) || !statSync(folder).isDirectory()) {
  fail(
    `Image folder not found: ${folder}\n` +
      "  Create it and drop your images in (named by SKU), or pass a path:\n" +
      "  npm run upload:images -- ./path/to/images",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Parse image stem → { sku, slot }.
 * Main = no numeric suffix (SKU.jpg). Numbered suffixes (_1, _2, -3) are gallery only.
 * Slot 1 = main; gallery slots are 2+ ordered by the file number (_1→2, _2→3, …).
 */
function parseImageName(stem: string): { sku: string; slot: number } | null {
  const match = /^(.+?)(?:[-_](\d+))?$/i.exec(stem.trim());
  if (!match) return null;
  const sku = match[1];
  if (!sku) return null;
  if (!match[2]) return { sku, slot: 1 };
  const n = Number(match[2]);
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  // Numbered files are never main — shift so _1/_2/_3 become gallery slots 2/3/4
  return { sku, slot: n + 1 };
}

async function ensureBucket() {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (data && !error) return;

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });
  if (createError && !/already exists/i.test(createError.message)) {
    fail(`Could not create bucket "${BUCKET}": ${createError.message}`);
  }
  console.log(`• Bucket "${BUCKET}" is ready (public).`);
}

async function run() {
  await ensureBucket();

  const files = readdirSync(folder).filter((file) =>
    Object.keys(CONTENT_TYPES).includes(extname(file).toLowerCase()),
  );

  if (files.length === 0) {
    fail(`No image files found in ${folder}`);
  }

  console.log(`• Found ${files.length} image(s) in ${folder}\n`);

  type SlotFile = { slot: number; file: string; ext: string };
  const bySku = new Map<string, SlotFile[]>();

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const stem = basename(file, ext);
    const parsed = parseImageName(stem);
    if (!parsed) {
      console.warn(`  ⚠ ${file}: could not parse SKU — skipped`);
      continue;
    }
    // Typo fix: MC#### files are MD#### products
    let sku = parsed.sku.toUpperCase();
    if (/^MC\d/.test(sku)) {
      sku = `MD${sku.slice(2)}`;
      console.log(`  • ${file}: MC→MD mapped to ${sku}`);
    }
    const list = bySku.get(sku) ?? [];
    list.push({ slot: parsed.slot, file, ext });
    bySku.set(sku, list);
  }

  let linked = 0;
  const unmatched: string[] = [];

  for (const [skuKey, slots] of bySku) {
    slots.sort((a, b) => a.slot - b.slot);

    const urlsBySlot = new Map<number, string>();

    for (const slot of slots) {
      const objectPath = `${skuKey}${slot.slot === 1 ? "" : `-${slot.slot}`}${slot.ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, readFileSync(join(folder, slot.file)), {
          contentType: CONTENT_TYPES[slot.ext],
          upsert: true,
        });

      if (uploadError) {
        console.warn(`  ⚠ ${slot.file}: upload failed — ${uploadError.message}`);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      urlsBySlot.set(slot.slot, publicUrl);
    }

    if (urlsBySlot.size === 0) continue;

    const mainUrl = urlsBySlot.get(1) ?? [...urlsBySlot.values()][0];
    const gallery = [...urlsBySlot.entries()]
      .filter(([slot]) => slot !== 1)
      .sort((a, b) => a[0] - b[0])
      .map(([, url]) => url);

    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({
        image_url: mainUrl,
        gallery_images: gallery,
      })
      .ilike("sku", skuKey)
      .select("id, sku");

    if (updateError) {
      console.warn(`  ⚠ ${skuKey}: DB update failed — ${updateError.message}`);
      continue;
    }

    if (updated && updated.length > 0) {
      linked += updated.length;
      const extras = gallery.length ? ` + ${gallery.length} gallery` : "";
      console.log(`  ✓ ${updated[0].sku} → main${extras}`);
    } else {
      unmatched.push(skuKey);
      console.log(`  • ${skuKey} → uploaded, but no product with this SKU`);
    }
  }

  console.log(`\nDone. Linked images on ${linked} product(s).`);
  if (unmatched.length > 0) {
    console.log(`Unmatched SKUs: ${unmatched.join(", ")}`);
  }
}

run().catch((error) => fail(error instanceof Error ? error.message : String(error)));
