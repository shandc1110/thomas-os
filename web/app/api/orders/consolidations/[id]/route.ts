import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  getConsolidationById,
  removeOrderFromConsolidation,
  updateConsolidationStatus,
} from "@/lib/orders/consolidation";
import type { ConsolidationStatus } from "@/types/consolidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set<ConsolidationStatus>([
  "draft",
  "ready",
  "invoiced",
  "fulfilled",
  "cancelled",
]);

export const GET = staffRoute<{ id: string }>(async ({ supabase, params }) => {
  const orgId = getOrganizationId();
  const { consolidation, error } = await getConsolidationById(
    supabase,
    orgId,
    params.id,
  );
  if (error || !consolidation) {
    return NextResponse.json(
      { success: false, error: error ?? "Not found." },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, consolidation });
});

export const PATCH = staffRoute<{ id: string }>(async ({ request, supabase, params }) => {
  const orgId = getOrganizationId();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  if (action === "remove_order") {
    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    if (!orderId) {
      return NextResponse.json({ success: false, error: "order_id required." }, { status: 400 });
    }
    const { consolidation, error } = await removeOrderFromConsolidation(
      supabase,
      orgId,
      params.id,
      orderId,
    );
    if (error || !consolidation) {
      return NextResponse.json({ success: false, error: error ?? "Failed." }, { status: 400 });
    }
    return NextResponse.json({ success: true, consolidation });
  }

  if (action === "set_status") {
    const status = body.status as ConsolidationStatus;
    if (!STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
    }
    const { consolidation, error } = await updateConsolidationStatus(
      supabase,
      orgId,
      params.id,
      status,
    );
    if (error || !consolidation) {
      return NextResponse.json({ success: false, error: error ?? "Failed." }, { status: 400 });
    }
    return NextResponse.json({ success: true, consolidation });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
