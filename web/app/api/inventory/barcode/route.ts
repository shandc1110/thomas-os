import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getProductByBarcode } from "@/lib/inventory/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ success: false, error: "Barcode required." }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { product, error } = await getProductByBarcode(supabase, code);
    if (error || !product) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, product });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}
