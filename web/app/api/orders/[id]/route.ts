import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { cancelOrder, getOrderById, markOrderFulfilled } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { order, error } = await getOrderById(supabase, params.id, orgId);

  if (error || !order) {
    return NextResponse.json(
      { success: false, error: error ?? "Order not found." },
      { status: error?.includes("not found") ? 404 : 500 },
    );
  }

  return NextResponse.json({ success: true, order });
});

export const PATCH = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const orgId = getOrganizationId();
  const body = await request.json();
  const action = body?.action as string | undefined;

  if (action === "cancel") {
    const { order, error } = await cancelOrder(supabase, params.id, orgId);
    if (error || !order) {
      return NextResponse.json({ success: false, error: error ?? "Cancel failed." }, { status: 400 });
    }
    return NextResponse.json({ success: true, order });
  }

  if (action === "fulfill" || action === "fulfil") {
    const { order, error } = await markOrderFulfilled(supabase, params.id, orgId);
    if (error || !order) {
      return NextResponse.json({ success: false, error: error ?? "Fulfil failed." }, { status: 400 });
    }
    return NextResponse.json({ success: true, order });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
