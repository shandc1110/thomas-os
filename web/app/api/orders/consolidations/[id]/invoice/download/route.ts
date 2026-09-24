import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { downloadInvoicePdf } from "@/lib/orders/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { buffer, filename, error } = await downloadInvoicePdf(
    supabase,
    orgId,
    params.id,
  );
  if (error || !filename) {
    return NextResponse.json({ success: false, error: error ?? "Not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
