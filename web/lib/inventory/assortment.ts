import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssortmentStatus } from "@/lib/types";
import { getSellableStock } from "@/lib/presell";
import type { ProductMaster } from "@/types/inventory";

export const ASSORTMENT_STATUSES: AssortmentStatus[] = ["active", "paused", "retired"];

export type AssortmentFilter = "all" | "not_reviewed" | AssortmentStatus;

export type StockFilter = "all" | "in_stock" | "out_of_stock" | "presell";

export type AssortmentListItem = Pick<
  ProductMaster,
  | "id"
  | "sku"
  | "name"
  | "brand"
  | "category"
  | "price"
  | "currency"
  | "image_url"
  | "stock"
  | "presell_enabled"
  | "presell_quantity"
  | "active"
  | "status"
  | "assortment_status"
>;

export type AssortmentCounts = {
  all: number;
  not_reviewed: number;
  active: number;
  paused: number;
  retired: number;
};

export type AssortmentListOptions = {
  organizationId: string;
  search?: string;
  assortment?: AssortmentFilter;
  brand?: string;
  category?: string;
  activeFilter?: "all" | "active" | "inactive";
  stockFilter?: StockFilter;
  page?: number;
  limit?: number;
};

export type AssortmentListResult = {
  products: AssortmentListItem[];
  total: number;
  page: number;
  limit: number;
  counts: AssortmentCounts;
};

/** UI label for assortment_status (NULL → Not reviewed). */
export function assortmentStatusLabel(status: AssortmentStatus | null | undefined): string {
  if (status == null) return "Not reviewed";
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "retired":
      return "Retired";
    default:
      return "Not reviewed";
  }
}

export function isValidAssortmentStatus(value: unknown): value is AssortmentStatus {
  return typeof value === "string" && ASSORTMENT_STATUSES.includes(value as AssortmentStatus);
}

function mapAssortmentRow(row: Record<string, unknown>): AssortmentListItem {
  return {
    id: row.id as string | number,
    sku: (row.sku as string | null) ?? null,
    name: row.name as string,
    brand: (row.brand as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    price: row.price != null ? Number(row.price) : null,
    currency: (row.currency as string | null) ?? null,
    image_url: (row.image_url as string | null) ?? null,
    stock: (row.stock as number | null) ?? 0,
    presell_enabled: (row.presell_enabled as boolean | null) ?? false,
    presell_quantity: (row.presell_quantity as number | null) ?? 0,
    active: (row.active as boolean | null) ?? true,
    status: (row.status as ProductMaster["status"]) ?? "active",
    assortment_status: (row.assortment_status as AssortmentStatus | null) ?? null,
  };
}

function matchesStockFilter(product: AssortmentListItem, filter: StockFilter): boolean {
  if (filter === "all") return true;
  const sellable = getSellableStock(product);
  const presellOnly =
    Math.max(product.stock ?? 0, 0) <= 0 &&
    Boolean(product.presell_enabled) &&
    Math.max(product.presell_quantity ?? 0, 0) > 0;
  if (filter === "in_stock") return sellable > 0 && !presellOnly;
  if (filter === "out_of_stock") return sellable <= 0;
  if (filter === "presell") return presellOnly;
  return true;
}

export async function getAssortmentCounts(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ counts: AssortmentCounts; error: string | null }> {
  const { data, error } = await supabase
    .from("products")
    .select("assortment_status")
    .eq("organization_id", organizationId);

  if (error) return { counts: emptyCounts(), error: error.message };

  const counts = emptyCounts();
  for (const row of data ?? []) {
    counts.all++;
    const status = row.assortment_status as AssortmentStatus | null;
    if (status == null) counts.not_reviewed++;
    else if (status === "active") counts.active++;
    else if (status === "paused") counts.paused++;
    else if (status === "retired") counts.retired++;
  }

  return { counts, error: null };
}

function emptyCounts(): AssortmentCounts {
  return { all: 0, not_reviewed: 0, active: 0, paused: 0, retired: 0 };
}

const LIST_SELECT =
  "id, sku, name, brand, category, price, currency, image_url, stock, presell_enabled, presell_quantity, active, status, assortment_status";

export async function listAssortmentProducts(
  supabase: SupabaseClient,
  options: AssortmentListOptions,
): Promise<{ result: AssortmentListResult | null; error: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const page = Math.max(options.page ?? 1, 1);

  let query = supabase
    .from("products")
    .select(LIST_SELECT, { count: "exact" })
    .eq("organization_id", options.organizationId)
    .order("name");

  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    query = query.or(`sku.ilike.${term},name.ilike.${term},brand.ilike.${term}`);
  }

  if (options.assortment && options.assortment !== "all") {
    if (options.assortment === "not_reviewed") {
      query = query.is("assortment_status", null);
    } else {
      query = query.eq("assortment_status", options.assortment);
    }
  }

  if (options.brand?.trim()) {
    query = query.eq("brand", options.brand.trim());
  }

  if (options.category?.trim()) {
    query = query.eq("category", options.category.trim());
  }

  if (options.activeFilter === "active") {
    query = query.eq("active", true);
  } else if (options.activeFilter === "inactive") {
    query = query.eq("active", false);
  }

  const { counts, error: countsError } = await getAssortmentCounts(supabase, options.organizationId);
  if (countsError) return { result: null, error: countsError };

  const stockFilter = options.stockFilter ?? "all";
  if (stockFilter === "all") {
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return { result: null, error: error.message };

    return {
      result: {
        products: (data ?? []).map((row) => mapAssortmentRow(row as Record<string, unknown>)),
        total: count ?? 0,
        page,
        limit,
        counts,
      },
      error: null,
    };
  }

  // Stock / presell filters use getSellableStock — filter in memory then paginate.
  const { data, error } = await query;
  if (error) return { result: null, error: error.message };

  const mapped = (data ?? []).map((row) => mapAssortmentRow(row as Record<string, unknown>));
  const filtered = mapped.filter((p) => matchesStockFilter(p, stockFilter));
  const total = filtered.length;
  const offset = (page - 1) * limit;
  const products = filtered.slice(offset, offset + limit);

  return {
    result: {
      products,
      total,
      page,
      limit,
      counts,
    },
    error: null,
  };
}

/** Updates only assortment_status (+ updated_at). Does not touch active, status, or inventory. */
export async function updateProductAssortmentStatus(
  supabase: SupabaseClient,
  productId: string,
  assortmentStatus: AssortmentStatus,
  organizationId: string,
): Promise<{ product: AssortmentListItem | null; error: string | null }> {
  if (!isValidAssortmentStatus(assortmentStatus)) {
    return { product: null, error: "Invalid assortment status." };
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      assortment_status: assortmentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .select(LIST_SELECT)
    .maybeSingle();

  if (error) return { product: null, error: error.message };
  if (!data) return { product: null, error: "Product not found." };

  return { product: mapAssortmentRow(data as Record<string, unknown>), error: null };
}

export async function bulkUpdateAssortmentStatus(
  supabase: SupabaseClient,
  productIds: string[],
  assortmentStatus: AssortmentStatus,
  organizationId: string,
): Promise<{ updated: number; failed: string[]; error: string | null }> {
  if (!isValidAssortmentStatus(assortmentStatus)) {
    return { updated: 0, failed: productIds, error: "Invalid assortment status." };
  }

  const ids = [...new Set(productIds.map(String).filter(Boolean))];
  if (ids.length === 0) {
    return { updated: 0, failed: [], error: "No product IDs provided." };
  }

  const { data, error } = await supabase
    .from("products")
    .update({
      assortment_status: assortmentStatus,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) return { updated: 0, failed: ids, error: error.message };

  const updatedIds = new Set((data ?? []).map((row) => String(row.id)));
  const failed = ids.filter((id) => !updatedIds.has(id));

  return { updated: updatedIds.size, failed, error: null };
}

export async function listAssortmentFilterOptions(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ brands: string[]; categories: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from("products")
    .select("brand, category")
    .eq("organization_id", organizationId);

  if (error) return { brands: [], categories: [], error: error.message };

  const brands = new Set<string>();
  const categories = new Set<string>();
  for (const row of data ?? []) {
    const brand = (row.brand as string | null)?.trim();
    const category = (row.category as string | null)?.trim();
    if (brand) brands.add(brand);
    if (category) categories.add(category);
  }

  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    error: null,
  };
}
