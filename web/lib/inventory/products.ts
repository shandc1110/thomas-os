import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InventoryDashboardStats, InventoryAlert, ProductMaster } from "@/types/inventory";
import { listMovements } from "./movements";

export async function getDashboardStats(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<{ stats: InventoryDashboardStats | null; error: string | null }> {
  let productsQuery = supabase
    .from("products")
    .select("id, sku, brand, cost_price, stock, low_stock_threshold, active");

  if (organizationId) {
    productsQuery = productsQuery.eq("organization_id", organizationId);
  }

  const { data: products, error: prodError } = await productsQuery;

  if (prodError) return { stats: null, error: prodError.message };

  const { data: balances } = await supabase.from("inventory_balances").select("*");

  const productList = products ?? [];
  const balanceList = balances ?? [];

  let available_units = 0;
  let incoming_units = 0;
  let allocated_units = 0;
  let inventory_value = 0;
  let low_stock_count = 0;
  let out_of_stock_count = 0;

  const brandMap = new Map<string, { units: number; value: number }>();

  for (const p of productList) {
    const stock = (p.stock as number) ?? 0;
    const cost = (p.cost_price as number) ?? 0;
    const threshold = (p.low_stock_threshold as number) ?? 5;
    const brand = (p.brand as string) ?? "Unknown";

    inventory_value += stock * cost;
    if (stock <= 0) out_of_stock_count++;
    else if (stock <= threshold) low_stock_count++;

    const existing = brandMap.get(brand) ?? { units: 0, value: 0 };
    existing.units += stock;
    existing.value += stock * cost;
    brandMap.set(brand, existing);
  }

  for (const b of balanceList) {
    available_units += (b.available as number) ?? 0;
    incoming_units += (b.incoming as number) ?? 0;
    allocated_units += (b.allocated as number) ?? 0;
  }

  const { movements } = await listMovements(supabase, { limit: 10 });

  return {
    stats: {
      total_products: productList.length,
      total_skus: productList.filter((p) => p.sku).length,
      inventory_value,
      available_units,
      incoming_units,
      allocated_units,
      low_stock_count,
      out_of_stock_count,
      by_brand: [...brandMap.entries()]
        .map(([brand, data]) => ({ brand, ...data }))
        .sort((a, b) => b.value - a.value),
      recent_movements: movements,
    },
    error: null,
  };
}

export async function generateAlerts(
  supabase: SupabaseClient,
  organizationId?: string,
): Promise<{ alerts: InventoryAlert[]; error: string | null }> {
  let query = supabase
    .from("products")
    .select("id, sku, name, stock, low_stock_threshold, updated_at, created_at");

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data: products } = await query;

  const newAlerts: { alert_type: string; product_id: number; message: string; severity: string }[] =
    [];

  for (const p of products ?? []) {
    const stock = (p.stock as number) ?? 0;
    const threshold = (p.low_stock_threshold as number) ?? 5;
    const sku = (p.sku as string) ?? "Unknown";

    if (stock < 0) {
      newAlerts.push({
        alert_type: "negative_stock",
        product_id: p.id as number,
        message: `${sku} has negative stock (${stock})`,
        severity: "critical",
      });
    } else if (stock === 0) {
      newAlerts.push({
        alert_type: "out_of_stock",
        product_id: p.id as number,
        message: `${sku} is out of stock`,
        severity: "warning",
      });
    } else if (stock <= threshold) {
      newAlerts.push({
        alert_type: "low_stock",
        product_id: p.id as number,
        message: `${sku} is low stock (${stock} remaining, threshold ${threshold})`,
        severity: "warning",
      });
    }
  }

  for (const alert of newAlerts) {
    const { data: existing } = await supabase
      .from("inventory_alerts")
      .select("id")
      .eq("product_id", alert.product_id)
      .eq("alert_type", alert.alert_type)
      .eq("acknowledged", false)
      .limit(1);

    if (!existing?.length) {
      await supabase.from("inventory_alerts").insert(alert);
    }
  }

  const { data, error } = await supabase
    .from("inventory_alerts")
    .select(`*, products ( sku, name )`)
    .eq("acknowledged", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { alerts: [], error: error.message };

  return {
    alerts: (data ?? []).map((row) => ({
      id: row.id as string,
      alert_type: row.alert_type as string,
      product_id: row.product_id as number | null,
      message: row.message as string,
      severity: row.severity as "info" | "warning" | "critical",
      acknowledged: row.acknowledged as boolean,
      created_at: row.created_at as string,
      product: (row as { products?: { sku: string | null; name: string } }).products,
    })),
    error: null,
  };
}

export async function listProducts(
  supabase: SupabaseClient,
  options: { search?: string; sort?: string; limit?: number; organizationId?: string } = {},
): Promise<{ products: ProductMaster[]; error: string | null }> {
  let query = supabase.from("products").select("*").order("updated_at", { ascending: false });

  if (options.organizationId) {
    query = query.eq("organization_id", options.organizationId);
  }

  if (options.search) {
    const term = `%${options.search}%`;
    query = query.or(`sku.ilike.${term},name.ilike.${term},barcode.ilike.${term}`);
  }

  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) return { products: [], error: error.message };

  return {
    products: (data ?? []).map(mapProductRow),
    error: null,
  };
}

export async function getProductById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ product: ProductMaster | null; error: string | null }> {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) return { product: null, error: error.message };
  return { product: mapProductRow(data), error: null };
}

export async function getProductByBarcode(
  supabase: SupabaseClient,
  barcode: string,
): Promise<{ product: ProductMaster | null; error: string | null }> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode)
    .single();

  if (error) return { product: null, error: error.message };
  return { product: mapProductRow(data), error: null };
}

export async function upsertProduct(
  supabase: SupabaseClient,
  input: Partial<ProductMaster> & { sku: string; name: string; organization_id?: string },
): Promise<{ product: ProductMaster | null; error: string | null }> {
  const payload = {
    sku: input.sku,
    name: input.name,
    ...(input.organization_id ? { organization_id: input.organization_id } : {}),
    brand: input.brand ?? null,
    category: input.category ?? null,
    description: input.description ?? null,
    barcode: input.barcode ?? null,
    weight_grams: input.weight_grams ?? null,
    length_mm: input.length_mm ?? null,
    width_mm: input.width_mm ?? null,
    height_mm: input.height_mm ?? null,
    country_of_origin: input.country_of_origin ?? null,
    hs_code: input.hs_code ?? null,
    cost_price: input.cost_price ?? null,
    wholesale_price: input.wholesale_price ?? null,
    retail_price: input.retail_price ?? input.price ?? null,
    price: input.retail_price ?? input.price ?? null,
    shopify_price: input.shopify_price ?? null,
    currency: input.currency ?? "CNY",
    status: input.status ?? "active",
    active: input.status !== "discontinued" && input.active !== false,
    image_url: input.image_url ?? null,
    gallery_images: input.gallery_images ?? [],
    tags: input.tags ?? [],
    low_stock_threshold: input.low_stock_threshold ?? 5,
    presell_enabled: input.presell_enabled ?? false,
    presell_quantity: input.presell_quantity ?? 0,
    expected_arrival_month: input.expected_arrival_month ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "sku" })
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: mapProductRow(data), error: null };
}

export async function updateProductPresell(
  supabase: SupabaseClient,
  productId: string,
  input: {
    presell_enabled: boolean;
    presell_quantity: number;
    expected_arrival_month: string | null;
  },
): Promise<{ product: ProductMaster | null; error: string | null }> {
  const { data, error } = await supabase
    .from("products")
    .update({
      presell_enabled: input.presell_enabled,
      presell_quantity: Math.max(0, input.presell_quantity),
      expected_arrival_month: input.expected_arrival_month,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: mapProductRow(data), error: null };
}

export async function updateProductPricing(
  supabase: SupabaseClient,
  productId: string,
  input: {
    cost_price?: number | null;
    price?: number | null;
    retail_price?: number | null;
    shopify_price?: number | null;
  },
): Promise<{ product: ProductMaster | null; error: string | null }> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if ("cost_price" in input) {
    payload.cost_price = input.cost_price ?? null;
  }
  if ("price" in input) {
    payload.price = input.price ?? null;
  }
  if ("retail_price" in input) {
    payload.retail_price = input.retail_price ?? null;
  }
  if ("shopify_price" in input) {
    payload.shopify_price = input.shopify_price ?? null;
  }

  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId)
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: mapProductRow(data), error: null };
}

export async function updateProductShipping(
  supabase: SupabaseClient,
  productId: string,
  input: {
    weight_grams: number | null;
    length_mm: number | null;
    width_mm: number | null;
    height_mm: number | null;
  },
): Promise<{ product: ProductMaster | null; error: string | null }> {
  const { data, error } = await supabase
    .from("products")
    .update({
      weight_grams: input.weight_grams,
      length_mm: input.length_mm,
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: mapProductRow(data), error: null };
}

function mapProductRow(row: Record<string, unknown>): ProductMaster {
  return {
    id: row.id as string | number,
    sku: (row.sku as string | null) ?? null,
    name: row.name as string,
    brand: (row.brand as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    barcode: (row.barcode as string | null) ?? null,
    weight_grams: (row.weight_grams as number | null) ?? null,
    length_mm: (row.length_mm as number | null) ?? null,
    width_mm: (row.width_mm as number | null) ?? null,
    height_mm: (row.height_mm as number | null) ?? null,
    country_of_origin: (row.country_of_origin as string | null) ?? null,
    hs_code: (row.hs_code as string | null) ?? null,
    cost_price: row.cost_price != null ? Number(row.cost_price) : null,
    wholesale_price: row.wholesale_price != null ? Number(row.wholesale_price) : null,
    retail_price: row.retail_price != null ? Number(row.retail_price) : null,
    price: row.price != null ? Number(row.price) : null,
    shopify_price: row.shopify_price != null ? Number(row.shopify_price) : null,
    currency: (row.currency as string | null) ?? "CNY",
    status: (row.status as ProductMaster["status"]) ?? "active",
    active: (row.active as boolean | null) ?? true,
    image_url: (row.image_url as string | null) ?? null,
    gallery_images: (row.gallery_images as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    low_stock_threshold: (row.low_stock_threshold as number | null) ?? 5,
    presell_enabled: (row.presell_enabled as boolean | null) ?? false,
    presell_quantity: (row.presell_quantity as number | null) ?? 0,
    expected_arrival_month: (row.expected_arrival_month as string | null) ?? null,
    stock: (row.stock as number | null) ?? 0,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}
