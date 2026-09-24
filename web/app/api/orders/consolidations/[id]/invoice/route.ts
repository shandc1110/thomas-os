import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import { generateConsolidationInvoice } from "@/lib/orders/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Generate (or regenerate) invoice PDF for a consolidation — idempotent number. */
export const POST = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { invoice, error } = await generateConsolidationInvoice(
    supabase,
    orgId,
    params.id,
  );
  if (error || !invoice) {
    return NextResponse.json({ success: false, error: error ?? "Failed." }, { status: 400 });
  }
  return NextResponse.json({ success: true, invoice });
});
