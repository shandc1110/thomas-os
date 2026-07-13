import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { addStockTakeLine, approveStockTake } from "@/lib/inventory/stock-take";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.action === "approve") {
      const { error } = await approveStockTake(supabase, id, body.approved_by);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, message: "Stock take approved." });
    }

    if (!body?.product_id || !body?.location_id || body.counted_quantity == null) {
      return NextResponse.json({ success: false, error: "Missing required fields." }, { status: 400 });
    }

    const { lineId, variance, error } = await addStockTakeLine(supabase, id, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, line_id: lineId, variance });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
