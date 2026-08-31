/**
 * Deactivate Le Toy Van products with no storefront image.
 * Sets active=false (storefront hides active-only products).
 *
 *   npx tsx scripts/deactivate-letoyvan-no-image.ts --dry
 *   npx tsx scripts/deactivate-letoyvan-no-image.ts
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";

loadEnv();

const DRY = process.argv.includes("--dry");

function hasImage(row: {
  image_url: string | null;
  gallery_images: string[] | null;
}): boolean {
  const url = row.image_url?.trim();
  if (url) return true;
  const gallery = row.gallery_images ?? [];
  return gallery.some((g) => typeof g === "string" && g.trim().length > 0);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("products")
    .select("id, sku, name, brand, image_url, gallery_images, active")
    .ilike("brand", "%le toy van%")
    .eq("active", true);

  if (error) throw error;

  const products = data ?? [];
  const withoutImage = products.filter((p) => !hasImage(p));
  const withImage = products.length - withoutImage.length;

  console.log(`Le Toy Van active: ${products.length}`);
  console.log(`  with image: ${withImage}`);
  console.log(`  without image: ${withoutImage.length}`);

  if (withoutImage.length === 0) {
    console.log("Nothing to deactivate.");
    return;
  }

  if (DRY) {
    console.log("\n--dry: no changes written.");
    for (const p of withoutImage.slice(0, 15)) {
      console.log(`  ${p.sku}  ${p.name}`);
    }
    if (withoutImage.length > 15) console.log(`  … and ${withoutImage.length - 15} more`);
    return;
  }

  const ids = withoutImage.map((p) => p.id);
  const { data: updated, error: upErr } = await supabase
    .from("products")
    .update({ active: false, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select("id, sku, active");

  if (upErr) throw upErr;

  console.log(`\nDeactivated ${updated?.length ?? 0} products (no image).`);
  console.log(`Storefront will show ${withImage} Le Toy Van products with images.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
