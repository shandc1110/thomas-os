import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { startStockTake, getStockTakeSession } from "@/lib/inventory/stock-take";
import { listMovements } from "@/lib/inventory/movements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  try {
    const supabase = getSupabaseAdmin();
    if (sessionId) {
      const { session, error } = await getStockTakeSession(supabase, sessionId);
      if (error) return NextResponse.json({ success: false, error }, { status: 404 });
      return NextResponse.json({ success: true, session });
    }

    const { data, error } = await supabase
      .from("stock_take_sessions")
      .select("*, warehouses ( code, name )")
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, sessions: data });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (!body?.warehouse_id) {
      return NextResponse.json({ success: false, error: "warehouse_id required." }, { status: 400 });
    }

    const { session, error } = await startStockTake(supabase, body.warehouse_id, body.started_by);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, session });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
