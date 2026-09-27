import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { listOrdersWithItems } from "@/lib/orders";
import {
  buildCombinedPackingSlipData,
  groupOrdersByShippingAddress,
  isOrderOpenForPacking,
} from "@/lib/orders/combined-packing-slip";
import { generateCombinedPackingSlipsPdf } from "@/lib/pdf/packingSlip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One PDF with a packing slip per shipping address, each referencing every order
 * number in the group. Body `{ order_ids }` limits to those orders (cancelled
 * skipped); without it, all open (unfulfilled, unshipped) orders are used.
 */
export const POST = staffRoute(async ({ request, supabase }) => {
  const orgId = getOrganizationId();
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Empty body means "all open orders".
  }

  const rawIds = body.order_ids;
  const orderIds = Array.isArray(rawIds)
    ? rawIds
        .filter((id) => (typeof id === "string" && id.length > 0) || typeof id === "number")
        .map(String)
    : [];

  const { orders, error } = await listOrdersWithItems(
    supabase,
    orgId,
    orderIds.length > 0 ? orderIds : undefined,
  );
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  const eligible =
    orderIds.length > 0
      ? orders.filter((o) => o.fulfilment_status !== "cancelled" && o.warehouse_status !== "cancelled")
      : orders.filter(isOrderOpenForPacking);

  if (eligible.length === 0) {
    return NextResponse.json(
      { success: false, error: "No orders to include in packing slips." },
      { status: 404 },
    );
  }

  try {
    const slips = groupOrdersByShippingAddress(eligible).map(buildCombinedPackingSlipData);
    const pdfBuffer = await generateCombinedPackingSlipsPdf(slips);
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="combined-packing-slips-${stamp}.pdf"`,
        "Cache-Control": "no-store",
        "X-Slip-Count": String(slips.length),
        "X-Order-Count": String(eligible.length),
      },
    });
  } catch (err) {
    console.error("Combined packing slip generation failed:", err);
    return NextResponse.json(
      { success: false, error: "Could not generate combined packing slips." },
      { status: 500 },
    );
  }
});
