import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  cancelOrder,
  getAdjacentOrders,
  getOrderById,
  markOrderFulfilled,
} from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const [{ order, error }, adjacent] = await Promise.all([
    getOrderById(supabase, params.id, orgId),
    getAdjacentOrders(supabase, params.id, orgId),
  ]);

  if (error || !order) {
    return NextResponse.json(
      { success: false, error: error ?? "Order not found." },
      { status: error?.includes("not found") ? 404 : 500 },
    );
  }

  return NextResponse.json({
    success: true,
    order,
    previous: adjacent.previous,
    next: adjacent.next,
  });
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

  if (action === "mark_slip_printed" || action === "mark_slip_unprinted") {
    const printedAt = action === "mark_slip_printed" ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("orders")
      .update({ packing_slip_printed_at: printedAt })
      .eq("id", params.id)
      .eq("organization_id", orgId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, packing_slip_printed_at: printedAt });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
