import { NextResponse } from "next/server";
import { staffRoute } from "@/lib/thomas/api/staff-route";
import { getOrganizationId } from "@/lib/thomas/tenant/scope";
import {
  listStorefrontReadiness,
  type AssortmentReviewFilter,
  type ReadinessFilter,
} from "@/lib/storefront/readiness-admin";
import { isValidAssortmentStatus } from "@/lib/inventory/assortment";
import type { StorefrontReadinessIssue } from "@/lib/storefront/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISSUE_FILTERS: StorefrontReadinessIssue[] = [
  "NOT_ELIGIBLE",
  "MISSING_IMAGE",
  "MISSING_BRAND",
  "MISSING_PRICE",
  "MISSING_CATEGORY",
  "MISSING_DESCRIPTION",
  "MISSING_NAME",
  "MISSING_SKU",
];

function parseAssortment(value: string | null): AssortmentReviewFilter {
  if (!value || value === "all") return "all";
  if (value === "not_reviewed") return "not_reviewed";
  if (isValidAssortmentStatus(value)) return value;
  return "all";
}

function parseReadiness(value: string | null): ReadinessFilter {
  if (!value || value === "all") return "all";
  if (value === "ready" || value === "not_ready") return value;
  if (ISSUE_FILTERS.includes(value as StorefrontReadinessIssue)) {
    return value as StorefrontReadinessIssue;
  }
  return "all";
}

/** Staff-only storefront readiness catalogue (read-only). */
export const GET = staffRoute(async ({ request, supabase }) => {
  const { searchParams } = new URL(request.url);
  const orgId = getOrganizationId();

  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");

  const { result, error } = await listStorefrontReadiness(supabase, {
    organizationId: orgId,
    search: searchParams.get("search") ?? undefined,
    assortment: parseAssortment(searchParams.get("assortment")),
    readiness: parseReadiness(searchParams.get("readiness")),
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  if (error || !result) {
    return NextResponse.json({ success: false, error: error ?? "List failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...result });
});
