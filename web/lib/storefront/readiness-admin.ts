/**
 * Admin storefront readiness — operational visibility only.
 * Reuses toStorefrontProduct + assessStorefrontReadiness (single source of truth).
 * Does not mutate assortment or invent content.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapProduct } from "@/lib/products/map-product";
import type { AssortmentStatus, Product } from "@/lib/types";
import { toStorefrontProduct } from "./map";
import type { StorefrontProduct, StorefrontReadinessIssue } from "./types";

export type AssortmentReviewFilter = "all" | "not_reviewed" | AssortmentStatus;

/** Filter by readiness outcome or a specific reported issue. */
export type ReadinessFilter =
  | "all"
  | "ready"
  | "not_ready"
  | StorefrontReadinessIssue;

export type StorefrontReadinessRow = {
  productId: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  assortmentStatus: AssortmentStatus | null;
  websiteEligible: boolean;
  joybuyEligible: boolean;
  /** Primary storefront label for the table (READY or first issue). */
  storefrontLabel: string;
  readinessStatus: "READY" | "NOT_READY";
  issues: StorefrontReadinessIssue[];
  /** Shopify UK commercial gate (explicit GBP). */
  shopifyCommercialStatus: "READY" | "NOT_READY";
  /** Joybuy UK commercial gate (explicit GBP). */
  joybuyCommercialStatus: "READY" | "NOT_READY";
  url: string;
  tags: string[];
  sellableStock: number;
};

export type StorefrontReadinessCounts = {
  assortment: {
    all: number;
    not_reviewed: number;
    active: number;
    paused: number;
    retired: number;
  };
  readiness: {
    ready: number;
    not_ready: number;
    NOT_ELIGIBLE: number;
    MISSING_IMAGE: number;
    MISSING_BRAND: number;
    MISSING_PRICE: number;
    MISSING_CATEGORY: number;
    MISSING_DESCRIPTION: number;
    MISSING_NAME: number;
    MISSING_SKU: number;
  };
};

const ISSUE_PRIORITY: StorefrontReadinessIssue[] = [
  "NOT_ELIGIBLE",
  "MISSING_IMAGE",
  "MISSING_BRAND",
  "MISSING_PRICE",
  "MISSING_NAME",
  "MISSING_SKU",
  "MISSING_CATEGORY",
  "MISSING_DESCRIPTION",
];

/** Deterministic primary label from readiness (single source of truth). */
export function primaryStorefrontLabel(
  readiness: StorefrontProduct["readiness"],
): string {
  if (readiness.status === "READY") return "READY";
  for (const issue of ISSUE_PRIORITY) {
    if (readiness.issues.includes(issue)) return issue;
  }
  return readiness.issues[0] ?? "NOT_READY";
}

export function productToReadinessRow(product: Product): StorefrontReadinessRow {
  const sf = toStorefrontProduct(product);
  return {
    productId: sf.productId,
    sku: sf.sku,
    name: sf.productName,
    brand: sf.brand,
    category: sf.category,
    imageUrl: sf.primaryImage,
    assortmentStatus: sf.assortmentStatus,
    websiteEligible: sf.websiteEligible,
    joybuyEligible: sf.joybuyEligible,
    storefrontLabel: primaryStorefrontLabel(sf.readiness),
    readinessStatus: sf.readiness.status,
    issues: sf.readiness.issues,
    shopifyCommercialStatus: sf.readiness.shopify.status,
    joybuyCommercialStatus: sf.readiness.joybuy.status,
    url: sf.url,
    tags: sf.tags,
    sellableStock: sf.sellableStock,
  };
}

function matchesAssortment(
  status: AssortmentStatus | null,
  filter: AssortmentReviewFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "not_reviewed") return status == null;
  return status === filter;
}

function matchesReadiness(row: StorefrontReadinessRow, filter: ReadinessFilter): boolean {
  if (filter === "all") return true;
  if (filter === "ready") return row.readinessStatus === "READY";
  if (filter === "not_ready") return row.readinessStatus === "NOT_READY";
  return row.issues.includes(filter);
}

function computeCounts(rows: StorefrontReadinessRow[]): StorefrontReadinessCounts {
  const assortment = {
    all: rows.length,
    not_reviewed: 0,
    active: 0,
    paused: 0,
    retired: 0,
  };
  const readiness = {
    ready: 0,
    not_ready: 0,
    NOT_ELIGIBLE: 0,
    MISSING_IMAGE: 0,
    MISSING_BRAND: 0,
    MISSING_PRICE: 0,
    MISSING_CATEGORY: 0,
    MISSING_DESCRIPTION: 0,
    MISSING_NAME: 0,
    MISSING_SKU: 0,
  };

  for (const row of rows) {
    if (row.assortmentStatus == null) assortment.not_reviewed += 1;
    else if (row.assortmentStatus === "active") assortment.active += 1;
    else if (row.assortmentStatus === "paused") assortment.paused += 1;
    else if (row.assortmentStatus === "retired") assortment.retired += 1;

    if (row.readinessStatus === "READY") readiness.ready += 1;
    else readiness.not_ready += 1;

    for (const issue of row.issues) {
      if (issue in readiness) {
        readiness[issue as keyof typeof readiness] += 1;
      }
    }
  }

  return { assortment, readiness };
}

async function fetchOrganizationListingProducts(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Product[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows
    .map(mapProduct)
    .filter((p) => p.is_listing_product !== false);
}

export type ListStorefrontReadinessOptions = {
  organizationId: string;
  search?: string;
  assortment?: AssortmentReviewFilter;
  readiness?: ReadinessFilter;
  page?: number;
  limit?: number;
};

export type ListStorefrontReadinessResult = {
  products: StorefrontReadinessRow[];
  total: number;
  page: number;
  limit: number;
  counts: StorefrontReadinessCounts;
};

/**
 * List listing products with assortment + readiness visibility.
 * Never mutates assortment. Never invents content.
 */
export async function listStorefrontReadiness(
  supabase: SupabaseClient,
  options: ListStorefrontReadinessOptions,
): Promise<{ result: ListStorefrontReadinessResult | null; error: string | null }> {
  try {
    const assortmentFilter = options.assortment ?? "all";
    const readinessFilter = options.readiness ?? "all";
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const search = options.search?.trim().toLowerCase() ?? "";

    const products = await fetchOrganizationListingProducts(supabase, options.organizationId);
    let rows = products.map(productToReadinessRow);
    const counts = computeCounts(rows);

    if (search) {
      rows = rows.filter((r) => {
        const hay = [r.name, r.sku, r.brand, r.category, ...r.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      });
    }

    rows = rows.filter(
      (r) =>
        matchesAssortment(r.assortmentStatus, assortmentFilter) &&
        matchesReadiness(r, readinessFilter),
    );

    const total = rows.length;
    const start = (page - 1) * limit;
    const pageRows = rows.slice(start, start + limit);

    return {
      result: {
        products: pageRows,
        total,
        page,
        limit,
        counts,
      },
      error: null,
    };
  } catch (e) {
    return {
      result: null,
      error: e instanceof Error ? e.message : "Readiness list failed.",
    };
  }
}
