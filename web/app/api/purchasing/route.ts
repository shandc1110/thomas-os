import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  listSuppliers,
  upsertSupplier,
  listBrands,
  upsertBrand,
  updateBrandContractStatus,
  getProcurementDashboard,
  listPurchaseOrders,
  createPurchaseOrder,
  getPurchaseOrder,
  updatePOStatus,
  receivePurchaseOrder,
  listShipments,
  createInboundShipment,
} from "@/lib/purchasing/suppliers";
import { seedStorefrontBrandsFromRegistry } from "@/lib/brands/storefront-active";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = staffRoute(async ({ request, supabase }) => {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource") ?? "dashboard";
  const orgId = getOrganizationId();

  switch (resource) {
    case "dashboard": {
      const { stats, error } = await getProcurementDashboard(supabase, orgId);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, stats });
    }
    case "suppliers": {
      const { suppliers, error } = await listSuppliers(supabase, orgId);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, suppliers });
    }
    case "brands": {
      const { brands, error } = await listBrands(supabase, orgId);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, brands });
    }
    case "purchase-orders": {
      const { orders, error } = await listPurchaseOrders(
        supabase,
        searchParams.get("status") ?? undefined,
        orgId,
      );
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
});

export const POST = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();
  const orgId = getOrganizationId();

  switch (body.resource) {
    case "supplier": {
      const { supplier, error } = await upsertSupplier(supabase, { ...body, organization_id: orgId });
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, supplier });
    }
    case "brand": {
      const { brand, error } = await upsertBrand(supabase, { ...body, organization_id: orgId });
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, brand });
    }
    case "brand-status": {
      const id = typeof body.id === "string" ? body.id.trim() : "";
      const status = body.contract_status === "inactive" ? "inactive" : "active";
      if (!id) {
        return NextResponse.json({ success: false, error: "id required." }, { status: 400 });
      }
      const { brand, error } = await updateBrandContractStatus(supabase, {
        id,
        contract_status: status,
        organization_id: orgId,
      });
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({ success: true, brand });
    }
    case "seed-storefront-brands": {
      const result = await seedStorefrontBrandsFromRegistry();
      if (result.error) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      const { brands, error } = await listBrands(supabase, orgId);
      if (error) return NextResponse.json({ success: false, error }, { status: 500 });
      return NextResponse.json({
        success: true,
        inserted: result.inserted,
        skipped: result.skipped,
        brands,
      });
    }
    case "purchase-order": {
      const { po, error } = await createPurchaseOrder(supabase, { ...body, organization_id: orgId });
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
});
