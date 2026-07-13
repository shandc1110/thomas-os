import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getWarehouseDashboard, listWarehouseOrders } from "@/lib/warehouse/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdmin();
    const [{ stats, error }, { orders }] = await Promise.all([
      getWarehouseDashboard(supabase),
      listWarehouseOrders(supabase),
    ]);
    if (error || !stats) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    return NextResponse.json({ success: true, stats, orders });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}
