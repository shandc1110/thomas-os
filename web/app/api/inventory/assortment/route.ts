import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  bulkUpdateAssortmentStatus,
  isValidAssortmentStatus,
  listAssortmentFilterOptions,
  listAssortmentProducts,
  updateProductAssortmentStatus,
  type AssortmentFilter,
  type StockFilter,
} from "@/lib/inventory/assortment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAssortmentFilter(value: string | null): AssortmentFilter {
  if (!value || value === "all") return "all";
  if (value === "not_reviewed") return "not_reviewed";
  if (isValidAssortmentStatus(value)) return value;
  return "all";
}

function parseStockFilter(value: string | null): StockFilter {
  if (value === "in_stock" || value === "out_of_stock" || value === "presell") return value;
  return "all";
}

function parseActiveFilter(value: string | null): "all" | "active" | "inactive" {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

/** Staff-only assortment catalogue for review. */
export const GET = staffRoute(async ({ request, supabase }) => {
  const { searchParams } = new URL(request.url);
  const orgId = getOrganizationId();

  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");

  const { result, error } = await listAssortmentProducts(supabase, {
    organizationId: orgId,
    search: searchParams.get("search") ?? undefined,
    assortment: parseAssortmentFilter(searchParams.get("assortment")),
    brand: searchParams.get("brand") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    activeFilter: parseActiveFilter(searchParams.get("active")),
    stockFilter: parseStockFilter(searchParams.get("stock")),
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  if (error || !result) {
    return NextResponse.json({ success: false, error: error ?? "List failed." }, { status: 500 });
  }

  const filters = await listAssortmentFilterOptions(supabase, orgId);

  return NextResponse.json({
    success: true,
    ...result,
    filterOptions: {
      brands: filters.brands,
      categories: filters.categories,
    },
  });
});

/** Updates assortment_status only — never active, status, stock, or price. */
export const PATCH = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();
  const orgId = getOrganizationId();
  const assortmentStatus = body?.assortment_status;

  if (!isValidAssortmentStatus(assortmentStatus)) {
    return NextResponse.json(
      { success: false, error: "assortment_status must be active, paused, or retired." },
      { status: 400 },
    );
  }

  const productIds = Array.isArray(body?.product_ids)
    ? body.product_ids.map(String)
  : body?.product_id != null
      ? [String(body.product_id)]
      : [];

  if (productIds.length === 0) {
    return NextResponse.json({ success: false, error: "product_id or product_ids required." }, {
      status: 400,
    });
  }

  if (productIds.length === 1) {
    const { product, error } = await updateProductAssortmentStatus(
      supabase,
      productIds[0],
      assortmentStatus,
      orgId,
    );
    if (error) {
      const status = error === "Product not found." ? 404 : 500;
      return NextResponse.json({ success: false, error }, { status });
    }
    return NextResponse.json({ success: true, product, updated: 1, failed: [] });
  }

  const { updated, failed, error } = await bulkUpdateAssortmentStatus(
    supabase,
    productIds,
    assortmentStatus,
    orgId,
  );

  if (error) {
    return NextResponse.json({ success: false, error, updated, failed }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated, failed });
});
