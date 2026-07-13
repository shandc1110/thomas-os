import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildPackingSlipData, getOrderById } from "@/lib/orders";
import { generatePackingSlipPdf } from "@/lib/pdf/packingSlip";

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
      { status: 404 },
    );
  }

  try {
    const slipData = buildPackingSlipData(order);
    const pdfBuffer = await generatePackingSlipPdf(slipData);
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
    console.error(`Packing slip generation failed for order ${id}:`, err);
    return NextResponse.json(
      { success: false, error: "Could not generate packing slip PDF." },
      { status: 500 },
    );
  }
}
