import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  createConsolidationFromOrderIds,
  listConsolidationCandidates,
  listConsolidations,
} from "@/lib/orders/consolidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List consolidations, or candidates when ?candidates=1 */
export const GET = staffRoute(async ({ request, supabase }) => {
  const orgId = getOrganizationId();
  const { searchParams } = new URL(request.url);

  if (searchParams.get("candidates") === "1") {
    const { groups, error } = await listConsolidationCandidates(supabase, orgId);
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    return NextResponse.json({ success: true, candidates: groups });
  }

  const { consolidations, error } = await listConsolidations(supabase, orgId);
  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
  return NextResponse.json({ success: true, consolidations });
});

/** Create consolidation from explicit order_ids (staff confirm). */
export const POST = staffRoute(async ({ request, supabase }) => {
  const orgId = getOrganizationId();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const rawIds = body.order_ids;
  const orderIds = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  const { consolidation, error } = await createConsolidationFromOrderIds(
    supabase,
    orgId,
    orderIds,
  );
  if (error || !consolidation) {
    const status = error?.includes("already") ? 409 : 400;
    return NextResponse.json({ success: false, error: error ?? "Failed." }, { status });
  }
  return NextResponse.json({ success: true, consolidation });
});
