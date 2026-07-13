import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listWarehouses, createWarehouse, createLocation } from "@/lib/warehouse/warehouses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdmin();
    const { warehouses, error } = await listWarehouses(supabase);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, warehouses });
  } catch {
    return NextResponse.json({ success: false, error: "Server not configured." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.type === "location") {
      const { location, error } = await createLocation(supabase, body);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, location });
    }

    const { warehouse, error } = await createWarehouse(supabase, body);
    if (error) return NextResponse.json({ success: false, error }, { status: 500 });
    return NextResponse.json({ success: true, warehouse });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
