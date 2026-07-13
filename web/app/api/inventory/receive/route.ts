import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { receiveGoods } from "@/lib/inventory/receive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    if (!body?.warehouse_id || !body?.location_id || !body?.lines?.length) {
      return NextResponse.json(
        { success: false, error: "warehouse_id, location_id, and lines are required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { receipt, error } = await receiveGoods(supabase, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, receipt });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
