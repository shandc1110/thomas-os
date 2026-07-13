import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOrderById } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { success: false, error: "Server is not configured. Missing service role key." },
      { status: 500 },
    );
  }

  const { order, error } = await getOrderById(supabase, id);

  if (error || !order) {
    return NextResponse.json(
      { success: false, error: error ?? "Order not found." },
      { status: error?.includes("not found") ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, order });
}
