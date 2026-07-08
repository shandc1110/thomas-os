/**
 * Upload product images to Supabase Storage and link them to products by SKU.
 *
 * Usage (run from the `web` folder):
 *   npm run upload:images                 # reads ./product-images
 *   npm run upload:images -- ./my-folder  # reads a custom folder
 *
 * Each image file must be named after the product SKU, e.g. "MID-001.jpg".
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

  let uploaded = 0;
  let linked = 0;
  const unmatched: string[] = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const sku = basename(file, ext);
    const contentType = CONTENT_TYPES[ext];
    const objectPath = `${sku}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, readFileSync(join(folder, file)), {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`  ⚠ ${file}: upload failed — ${uploadError.message}`);
      continue;
    }
    uploaded++;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({ image_url: publicUrl })
      .eq("sku", sku)
      .select("id");

    if (updateError) {
      console.warn(`  ⚠ ${sku}: DB update failed — ${updateError.message}`);
      continue;
    }

    if (updated && updated.length > 0) {
      linked += updated.length;
      console.log(`  ✓ ${sku} → linked to ${updated.length} product(s)`);
    } else {
      unmatched.push(sku);
      console.log(`  • ${sku} → uploaded, but no product with this SKU`);
    }
  }

  console.log(
    `\nDone. Uploaded ${uploaded} image(s), linked ${linked} product(s).`,
  );
  if (unmatched.length > 0) {
    console.log(
      `Unmatched SKUs (uploaded but no product row): ${unmatched.join(", ")}`,
    );
  }
}

run().catch((error) => fail(error instanceof Error ? error.message : String(error)));
