/**
 * Add a single Le Toy Van product from letoyvan.co.uk Shopify JSON.
 *
 *   npx tsx scripts/import-ltv-shopify-product.ts carlos-gelato
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./load-env";
import { stripHtml } from "./lib/shopify-catalog-import";

loadEnv();

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const BRAND = "Le Toy Van";
const SHOPIFY_BASE = "https://letoyvan.co.uk";
const PRESell_MONTH = "2026-09";
const DEFAULT_PRESell_QTY = 50;

const handle = process.argv[2]?.trim() || "carlos-gelato";

async function main() {
  const res = await fetch(`${SHOPIFY_BASE}/products/${handle}.json`);
  if (!res.ok) throw new Error(`Shopify product not found: ${handle} (${res.status})`);

  const { product } = (await res.json()) as {
    product: {
      title: string;
      handle: string;
      product_type: string;
      body_html: string;
      images: { src: string; variant_ids?: number[] }[];
      variants: { id: number; sku: string; price: string; barcode: string }[];
    };
  };

  const variant = product.variants[0];
  if (!variant?.sku) throw new Error("No variant SKU on product");

  const gallery = product.images.map((img) => img.src).filter(Boolean);
  const imageUrl =
    product.images.find((img) => img.variant_ids?.includes(variant.id))?.src ?? gallery[0] ?? null;
  const galleryRest = gallery.filter((url) => url !== imageUrl);

  const price = Math.round(Number(variant.price) * 100) / 100;
  const description = stripHtml(product.body_html).slice(0, 2000) || null;

  const payload = {
    sku: variant.sku.trim(),
    name: product.title.trim(),
    brand: BRAND,
    category: product.product_type?.trim() || null,
    description,
    barcode: variant.barcode?.trim() || null,
    price,
    retail_price: price,
    currency: "GBP",
    stock: 0,
    active: true,
    status: "active",
    image_url: imageUrl,
    gallery_images: galleryRest,
    presell_enabled: true,
    presell_quantity: DEFAULT_PRESell_QTY,
    expected_arrival_month: PRESell_MONTH,
    tags: [`cbc_vgroup:${product.handle}`, "cbc_listing", "cbc_vcount:1"],
    organization_id: ORG_ID,
    updated_at: new Date().toISOString(),
  };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "sku" })
    .select("id, sku, name, price, active, image_url")
    .single();

  if (error) throw error;

  console.log("Upserted Le Toy Van product:");
  console.log(data);
  console.log(`\nStorefront: /brands/le-toy-van (SKU ${data.sku})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
