import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  generatePickList,
  getPickListByOrder,
  startPicking,
  confirmPickLine,
  completePicking,
} from "@/lib/warehouse/picking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const orderId = new URL(request.url).searchParams.get("order_id");
  if (!orderId) {
    return NextResponse.json({ success: false, error: "order_id required." }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { pickList, error } = await getPickListByOrder(supabase, orderId);
    return NextResponse.json({ success: true, pick_list: pickList, error });
  } catch {
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.action === "generate") {
      const { pickList, error } = await generatePickList(supabase, body.order_id);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, pick_list: pickList });
    }

    if (body.action === "start") {
      const { error } = await startPicking(supabase, body.pick_list_id, body.picked_by);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === "confirm_line") {
      const { error } = await confirmPickLine(supabase, body.line_id, body);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === "complete") {
      const { error } = await completePicking(supabase, body.pick_list_id, body.picked_by);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
