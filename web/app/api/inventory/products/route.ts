import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listProducts, upsertProduct } from "@/lib/inventory/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  try {
    const supabase = getSupabaseAdmin();
    const { products, error } = await listProducts(supabase, { search });
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, products });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    if (!body?.sku || !body?.name) {
      return NextResponse.json({ success: false, error: "SKU and name are required." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { product, error } = await upsertProduct(supabase, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, product });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
