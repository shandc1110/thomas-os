import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getDashboardStats, generateAlerts } from "@/lib/inventory/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdmin();
    const [{ stats, error }, { alerts }] = await Promise.all([
      getDashboardStats(supabase),
      generateAlerts(supabase),
    ]);

    if (error || !stats) {
      return NextResponse.json({ success: false, error: error ?? "Failed to load dashboard." }, { status: 500 });
    }

    return NextResponse.json({ success: true, stats, alerts });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}
