/**
 * Active catalogue enrichment audit — assortment_status = 'active' only.
 * Reuses toStorefrontProduct / readiness (single source of truth).
 * Read-only list + lightweight category/description editor (no new columns).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapProduct } from "@/lib/products/map-product";
import { toStorefrontProduct } from "./map";
import { primaryStorefrontLabel } from "./readiness-admin";
import type { StorefrontProduct, StorefrontReadinessIssue } from "./types";

export type EnrichmentFilter =
  | "all"
  | "complete"
  | "missing_description"
  | "missing_category"
  | "missing_image"
  | "missing_brand";

export type ActiveEnrichmentRow = {
  productId: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  hasDescription: boolean;
  hasCategory: boolean;
  hasBrand: boolean;
  hasImage: boolean;
  primaryImage: string | null;
  galleryImageCount: number;
  price: number | null;
  currency: string;
  sellableStock: number;
  tags: string[];
  readinessStatus: "READY" | "NOT_READY";
  storefrontLabel: string;
  issues: StorefrontReadinessIssue[];
  url: string;
  /** True when no enrichment gaps among description/category/image/brand. */
  enrichmentComplete: boolean;
};

export type ActiveEnrichmentCounts = {
  all: number;
  complete: number;
  missing_description: number;
  missing_category: number;
  missing_image: number;
  missing_brand: number;
  ready: number;
  not_ready: number;
};

/** Trim free-text enrichment fields; blank → null (never invent content). */
export function normalizeEnrichmentText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function storefrontProductToEnrichmentRow(
  product: StorefrontProduct,
): ActiveEnrichmentRow {
  const hasDescription = Boolean(product.description?.trim());
  const hasCategory = Boolean(product.category?.trim());
  const hasBrand = Boolean(product.brand?.trim());
  const hasImage = Boolean(product.primaryImage?.trim());

  return {
    productId: product.productId,
    sku: product.sku,
    name: product.productName,
    brand: product.brand,
    category: product.category,
    description: product.description,
    hasDescription,
    hasCategory,
    hasBrand,
    hasImage,
    primaryImage: product.primaryImage,
    galleryImageCount: product.galleryImages?.length ?? 0,
    // Community / source price — enrichment is not UK channel pricing.
    price: product.sourcePrice,
    currency: product.sourceCurrency,
    sellableStock: product.sellableStock,
    tags: product.tags ?? [],
    readinessStatus: product.readiness.status,
    storefrontLabel: primaryStorefrontLabel(product.readiness),
    issues: product.readiness.issues,
    url: product.url,
    enrichmentComplete: hasDescription && hasCategory && hasBrand && hasImage,
  };
}

function matchesEnrichmentFilter(row: ActiveEnrichmentRow, filter: EnrichmentFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "complete":
      return row.enrichmentComplete;
    case "missing_description":
      return !row.hasDescription;
    case "missing_category":
      return !row.hasCategory;
    case "missing_image":
      return !row.hasImage;
    case "missing_brand":
      return !row.hasBrand;
    default:
      return true;
  }
}

function computeCounts(rows: ActiveEnrichmentRow[]): ActiveEnrichmentCounts {
  return {
    all: rows.length,
    complete: rows.filter((r) => r.enrichmentComplete).length,
    missing_description: rows.filter((r) => !r.hasDescription).length,
    missing_category: rows.filter((r) => !r.hasCategory).length,
    missing_image: rows.filter((r) => !r.hasImage).length,
    missing_brand: rows.filter((r) => !r.hasBrand).length,
    ready: rows.filter((r) => r.readinessStatus === "READY").length,
    not_ready: rows.filter((r) => r.readinessStatus === "NOT_READY").length,
  };
}

/**
 * Load assortment-active listing products and project via StorefrontProduct.
 */
export async function fetchActiveStorefrontProducts(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<StorefrontProduct[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("assortment_status", "active")
      .order("brand", { ascending: true })
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows
    .map(mapProduct)
    .filter((p) => p.is_listing_product !== false)
    .map((p) => toStorefrontProduct(p))
    .filter((p) => p.websiteEligible);
}

export type ListActiveEnrichmentOptions = {
  organizationId: string;
  search?: string;
  enrichment?: EnrichmentFilter;
  page?: number;
  limit?: number;
};

export type ListActiveEnrichmentResult = {
  products: ActiveEnrichmentRow[];
  total: number;
  page: number;
  limit: number;
  counts: ActiveEnrichmentCounts;
};

export async function listActiveCatalogueEnrichment(
  supabase: SupabaseClient,
  options: ListActiveEnrichmentOptions,
): Promise<{ result: ListActiveEnrichmentResult | null; error: string | null }> {
  try {
    const filter = options.enrichment ?? "all";
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const search = options.search?.trim().toLowerCase() ?? "";

    const storefront = await fetchActiveStorefrontProducts(
      supabase,
      options.organizationId,
    );
    let rows = storefront.map(storefrontProductToEnrichmentRow);
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

    rows = rows.filter((r) => matchesEnrichmentFilter(r, filter));

    const total = rows.length;
    const start = (page - 1) * limit;

    return {
      result: {
        products: rows.slice(start, start + limit),
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
      error: e instanceof Error ? e.message : "Enrichment list failed.",
    };
  }
}

/**
 * Chloe Edit candidates — heuristic shortlist for human review only.
 * Does not invent editorial reasons; uses existing completeness signals.
 */
export function proposeChloeEditCandidates(
  rows: ActiveEnrichmentRow[],
  limit = 12,
): ActiveEnrichmentRow[] {
  return [...rows]
    .filter((r) => r.hasImage && r.hasBrand && r.price != null && r.price > 0)
    .sort((a, b) => {
      const score = (r: ActiveEnrichmentRow) =>
        (r.hasDescription ? 4 : 0) +
        (r.hasCategory ? 2 : 0) +
        (r.galleryImageCount > 0 ? 2 : 0) +
        (r.sellableStock > 0 ? 1 : 0) +
        (r.readinessStatus === "READY" ? 1 : 0);
      return score(b) - score(a) || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export type EnrichmentUpdateResult = {
  row: ActiveEnrichmentRow | null;
  storefront: StorefrontProduct | null;
  error: string | null;
  /** HTTP-ish status hint for API layer. */
  status: number;
  /** Keys written to public.products (audit). */
  updatedFields: string[];
};

/**
 * Update category + description only for assortment-active products.
 * Does not touch assortment, price, stock, brand, sku, or identity fields.
 */
export async function updateActiveProductEnrichment(
  supabase: SupabaseClient,
  options: {
    productId: string;
    organizationId: string;
    category: unknown;
    description: unknown;
  },
): Promise<EnrichmentUpdateResult> {
  const category = normalizeEnrichmentText(options.category);
  const description = normalizeEnrichmentText(options.description);

  const { data: existing, error: loadError } = await supabase
    .from("products")
    .select("*")
    .eq("id", options.productId)
    .eq("organization_id", options.organizationId)
    .maybeSingle();

  if (loadError) {
    return {
      row: null,
      storefront: null,
      error: loadError.message,
      status: 500,
      updatedFields: [],
    };
  }
  if (!existing) {
    return {
      row: null,
      storefront: null,
      error: "Product not found.",
      status: 404,
      updatedFields: [],
    };
  }

  const current = mapProduct(existing as Record<string, unknown>);
  if (current.assortment_status !== "active") {
    return {
      row: null,
      storefront: null,
      error: "Only assortment-active products can be enriched here.",
      status: 403,
      updatedFields: [],
    };
  }

  const payload = {
    category,
    description,
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await supabase
    .from("products")
    .update(payload)
    .eq("id", options.productId)
    .eq("organization_id", options.organizationId)
    .eq("assortment_status", "active")
    .select("*")
    .maybeSingle();

  if (updateError) {
    return {
      row: null,
      storefront: null,
      error: updateError.message,
      status: 500,
      updatedFields: [],
    };
  }
  if (!updated) {
    return {
      row: null,
      storefront: null,
      error: "Update failed — product is not assortment-active.",
      status: 403,
      updatedFields: [],
    };
  }

  const storefront = toStorefrontProduct(mapProduct(updated as Record<string, unknown>));
  return {
    row: storefrontProductToEnrichmentRow(storefront),
    storefront,
    error: null,
    status: 200,
    updatedFields: ["category", "description", "updated_at"],
  };
}
