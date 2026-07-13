import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listMovements } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 50);

  try {
    const supabase = getSupabaseAdmin();
    const { movements, error } = await listMovements(supabase, {
      productId: productId ?? undefined,
      limit,
    });
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, movements });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}
