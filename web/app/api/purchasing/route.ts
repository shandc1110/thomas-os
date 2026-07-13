import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  listSuppliers,
  upsertSupplier,
  listBrands,
  upsertBrand,
  getProcurementDashboard,
  listPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrder,
  updatePOStatus,
  receivePurchaseOrder,
  listShipments,
  createInboundShipment,
} from "@/lib/purchasing/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") ?? "dashboard";

  try {
    const supabase = getSupabaseAdmin();

    switch (resource) {
      case "dashboard": {
        const { stats, error } = await getProcurementDashboard(supabase);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, stats });
      }
      case "suppliers": {
        const { suppliers, error } = await listSuppliers(supabase);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, suppliers });
      }
      case "brands": {
        const { brands, error } = await listBrands(supabase);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, brands });
      }
      case "purchase-orders": {
        const { orders, error } = await listPurchaseOrders(supabase, searchParams.get("status") ?? undefined);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, orders });
      }
      case "purchase-order": {
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ success: false, error: "id required." }, { status: 400 });
        const { po, error } = await getPurchaseOrder(supabase, id);
        if (error) return NextResponse.json({ success: false, error }, { status: 404 });
        return NextResponse.json({ success: true, po });
      }
      case "shipments": {
        const { shipments, error } = await listShipments(supabase);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, shipments });
      }
      default:
        return NextResponse.json({ success: false, error: "Unknown resource." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    switch (body.resource) {
      case "supplier": {
        const { supplier, error } = await upsertSupplier(supabase, body);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, supplier });
      }
      case "brand": {
        const { brand, error } = await upsertBrand(supabase, body);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, brand });
      }
      case "purchase-order": {
        const { po, error } = await createPurchaseOrder(supabase, body);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, po });
      }
      case "po-status": {
        const { error } = await updatePOStatus(supabase, body.id, body.status);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true });
      }
      case "receive-po": {
        const { error } = await receivePurchaseOrder(supabase, body);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true });
      }
      case "shipment": {
        const { shipment, error } = await createInboundShipment(supabase, body);
        if (error) return NextResponse.json({ success: false, error }, { status: 500 });
        return NextResponse.json({ success: true, shipment });
      }
      default:
        return NextResponse.json({ success: false, error: "Unknown resource." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }
}
