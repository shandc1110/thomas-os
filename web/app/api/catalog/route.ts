/**
 * Public storefront catalog — assortment-active products for the current tenant.
 * Eligibility: assortment_status = 'active' (never products.active alone).
 */
import { NextResponse } from "next/server";
import { brandSlugFromProductBrand } from "@/lib/brands";
import { resolveStorefrontBrandBySlug } from "@/lib/brands/storefront-active";
import { getStorefrontProducts } from "@/lib/storefront";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const brandSlug = new URL(request.url).searchParams.get("brand")?.trim().toLowerCase();

  if (brandSlug) {
    const brand = await resolveStorefrontBrandBySlug(brandSlug);
    if (!brand || !brand.active) {
      return NextResponse.json({ success: false, error: "Unknown brand." }, { status: 404 });
    }
  }

  try {
    let products = await getStorefrontProducts();
    if (brandSlug) {
      products = products.filter(
        (p) => brandSlugFromProductBrand(p.brand) === brandSlug,
      );
    }

    return NextResponse.json({ success: true, products, brand: brandSlug ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Catalog error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
