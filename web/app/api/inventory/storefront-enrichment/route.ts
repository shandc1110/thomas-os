import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  listActiveCatalogueEnrichment,
  updateActiveProductEnrichment,
  type EnrichmentFilter,
} from "@/lib/storefront/enrichment-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILTERS: EnrichmentFilter[] = [
  "all",
  "complete",
  "missing_description",
  "missing_category",
  "missing_image",
  "missing_brand",
];

function parseEnrichment(value: string | null): EnrichmentFilter {
  if (value && FILTERS.includes(value as EnrichmentFilter)) {
    return value as EnrichmentFilter;
  }
  return "all";
}

/** Staff-only active catalogue enrichment audit (read-only list). */
export const GET = staffRoute(async ({ request, supabase }) => {
  const { searchParams } = new URL(request.url);
  const orgId = getOrganizationId();

  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");

  const { result, error } = await listActiveCatalogueEnrichment(supabase, {
    organizationId: orgId,
    search: searchParams.get("search") ?? undefined,
    enrichment: parseEnrichment(searchParams.get("enrichment")),
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  if (error || !result) {
    return NextResponse.json({ success: false, error: error ?? "List failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...result });
});

/**
 * Staff-only enrichment save — category + description on active products only.
 * Auth: staffRoute (same as other inventory APIs).
 */
export const PATCH = staffRoute(async ({ request, supabase }) => {
  const body = await request.json();
  const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
  if (!productId) {
    return NextResponse.json({ success: false, error: "productId is required." }, { status: 400 });
  }

  const result = await updateActiveProductEnrichment(supabase, {
    productId,
    organizationId: getOrganizationId(),
    category: body?.category,
    description: body?.description,
  });

  if (result.error || !result.row) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Update failed." },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({
    success: true,
    product: result.row,
    storefront: result.storefront,
    updatedFields: result.updatedFields,
  });
});
