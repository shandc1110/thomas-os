export type AssortmentStatus = "active" | "paused" | "retired";

export type Product = {
  id: string | number;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  barcode: string | null;
  /** Community / console source selling price (Mideer: CNY). */
  price: number | null;
  retail_price: number | null;
  /** Explicit Chosen by Chloe UK / Shopify channel price in GBP. */
  shopify_price: number | null;
  /** Explicit Joybuy UK channel list price in GBP. Independent of shopify_price. */
  joybuy_price: number | null;
  cost_price: number | null;
  /** Native currency of community/source catalog price (CNY for Mideer, GBP for Micro/Tonies). */
  currency: string | null;
  image_url: string | null;
  gallery_images: string[];
  stock: number | null;
  presell_enabled: boolean | null;
  presell_quantity: number | null;
  expected_arrival_month: string | null;
  active: boolean | null;
  status: string | null;
  /** Commercial assortment — NULL = not yet reviewed. Storefront eligibility requires 'active'. */
  assortment_status: AssortmentStatus | null;
  /** Shopify-style variant group (listing parent + hidden SKU rows). */
  variant_group_key: string | null;
  is_listing_product: boolean | null;
  variant_option1: string | null;
  variant_option2: string | null;
  variant_count: number | null;
  weight_grams: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  /** Operational / variant tags (e.g. cbc_vgroup). Projected onto StorefrontProduct. */
  tags: string[];
  created_at: string | null;
  updated_at: string | null;
};
