import { NextResponse } from "next/server";
import { brandSlugFromProductBrand, getBrandBySlug } from "@/lib/brands";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTenant } from "@/lib/thomas/tenant/resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public storefront catalog — active products for the current tenant. */
export async function GET(request: Request) {
  const tenant = getActiveTenant();
  const supabase = getSupabaseAdmin();
  const brandSlug = new URL(request.url).searchParams.get("brand")?.trim().toLowerCase();

  if (brandSlug) {
    const brand = getBrandBySlug(brandSlug);
    if (!brand || !brand.active) {
      return NextResponse.json({ success: false, error: "Unknown brand." }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .eq("organization_id", tenant.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let products = data ?? [];
  if (brandSlug) {
    products = products.filter(
      (row) => brandSlugFromProductBrand((row as { brand?: string | null }).brand) === brandSlug,
    );
  }

  return NextResponse.json({ success: true, products, brand: brandSlug ?? null });
}
