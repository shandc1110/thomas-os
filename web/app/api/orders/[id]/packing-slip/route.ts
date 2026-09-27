import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { buildPackingSlipData, getOrderById, markPackingSlipsPrinted } from "@/lib/orders";
import { generatePackingSlipPdf } from "@/lib/pdf/packingSlip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { order, error } = await getOrderById(supabase, params.id, orgId);

  if (error || !order) {
    return NextResponse.json(
      { success: false, error: error ?? "Order not found." },
      { status: 404 },
    );
  }

  try {
    const slipData = buildPackingSlipData(order);
    const pdfBuffer = await generatePackingSlipPdf(slipData);
    await markPackingSlipsPrinted(supabase, [order.id], orgId);
    const filename = `packing-slip-${slipData.orderNumber}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`Packing slip generation failed for order ${params.id}:`, err);
    return NextResponse.json(
      { success: false, error: "Could not generate packing slip PDF." },
      { status: 500 },
    );
  }
});
