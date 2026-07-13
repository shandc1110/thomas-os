import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FulfilmentStatus,
  OrderItemRecord,
  OrderListItem,
  OrderRecord,
  OrderWithItems,
  PackingSlipData,
} from "@/types/order";
import { computeTotalWeightGrams } from "@/lib/weight";
import { getShopifyDraftOrderAdminUrl } from "@/lib/shopify/config";

type OrderRow = Record<string, unknown>;

type OrderItemRow = {
  id: string | number;
  order_id: string | number;
  product_id: string | number;
  quantity: number;
  price: number;
  products: {
    name: string;
    sku: string | null;
    weight_grams: number | null;
  } | null;
};

function mapOrderRow(row: OrderRow): OrderRecord {
  return {
    id: row.id as string | number,
    order_number: (row.order_number as string | null) ?? null,
    customer_name: (row.customer_name as string) ?? "",
    first_name: (row.first_name as string | null) ?? null,
    last_name: (row.last_name as string | null) ?? null,
    wechat_name: (row.wechat_name as string) ?? "",
    phone: (row.phone as string) ?? "",
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    postcode: (row.postcode as string | null) ?? null,
    payment_method: (row.payment_method as string | null) ?? null,
    currency: (row.currency as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    total_weight_grams: (row.total_weight_grams as number | null) ?? null,
    shopify_draft_order_id: (row.shopify_draft_order_id as string | null) ?? null,
    fulfilment_status: ((row.fulfilment_status as string) ?? "pending") as FulfilmentStatus,
    warehouse_status: ((row.warehouse_status as string) ?? "pending") as OrderRecord["warehouse_status"],
    tracking_number: (row.tracking_number as string | null) ?? null,
    shipped_at: (row.shipped_at as string | null) ?? null,
    picked_at: (row.picked_at as string | null) ?? null,
    packed_at: (row.packed_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
  };
}

function mapOrderItemRow(row: OrderItemRow): OrderItemRecord {
  return {
    id: row.id,
    order_id: row.order_id,
    product_id: row.product_id,
    quantity: row.quantity,
    price: row.price,
    product_name: row.products?.name ?? "Unknown item",
    product_sku: row.products?.sku ?? null,
    product_weight_grams: row.products?.weight_grams ?? null,
  };
}

function computeOrderTotal(items: OrderItemRecord[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export async function listOrders(supabase: SupabaseClient): Promise<{
  orders: OrderListItem[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items ( id, quantity, price )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listOrders failed:", error.message);
    return { orders: [], error: error.message };
  }

  const orders: OrderListItem[] = (data ?? []).map((row) => {
    const order = mapOrderRow(row as OrderRow);
    const items = ((row as { order_items?: { quantity: number; price: number }[] }).order_items ??
      []) as { quantity: number; price: number }[];
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const item_count = items.reduce((sum, item) => sum + item.quantity, 0);
    return { ...order, total, item_count };
  });

  return { orders, error: null };
}

export async function getOrderById(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ order: OrderWithItems | null; error: string | null }> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items (
        id,
        order_id,
        product_id,
        quantity,
        price,
        products ( name, sku, weight_grams )
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error) {
    console.error(`getOrderById(${orderId}) failed:`, error.message);
    return { order: null, error: error.message };
  }

  if (!data) return { order: null, error: "Order not found." };

  const order = mapOrderRow(data as OrderRow);
  const itemRows = ((data as { order_items?: OrderItemRow[] }).order_items ?? []) as OrderItemRow[];
  const items = itemRows.map(mapOrderItemRow);
  const total = computeOrderTotal(items);

  const shopify_admin_url = order.shopify_draft_order_id
    ? getShopifyDraftOrderAdminUrl(order.shopify_draft_order_id)
    : null;

  return {
    order: { ...order, items, total, shopify_admin_url },
    error: null,
  };
}

export function buildPackingSlipData(order: OrderWithItems): PackingSlipData {
  const orderNumber = order.order_number ?? String(order.id);
  const items = order.items.map((item) => ({
    name: item.product_name,
    sku: item.product_sku,
    quantity: item.quantity,
    unitPrice: item.price,
    lineTotal: item.price * item.quantity,
  }));

  const subtotal = order.total;
  const totalWeightGrams =
    order.total_weight_grams ??
    computeTotalWeightGrams(
      order.items.map((item) => ({
        weight_grams: item.product_weight_grams,
        quantity: item.quantity,
      })),
    );

  return {
    orderNumber,
    firstName: order.first_name ?? order.customer_name.split(" ")[0] ?? "",
    lastName:
      order.last_name ?? order.customer_name.split(" ").slice(1).join(" ") ?? "",
    customerName: order.customer_name,
    address: order.address ?? "",
    postcode: order.postcode ?? "",
    phone: order.phone,
    wechatId: order.wechat_name,
    paymentMethod: order.payment_method ?? "",
    currency: order.currency ?? "CNY",
    notes: order.notes,
    items,
    subtotal,
    grandTotal: subtotal,
    totalWeightGrams,
    createdAt: order.created_at,
  };
}

export async function updateOrderFulfilment(
  supabase: SupabaseClient,
  orderId: string | number,
  updates: {
    shopify_draft_order_id?: string;
    fulfilment_status?: FulfilmentStatus;
    total_weight_grams?: number;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("orders").update(updates).eq("id", orderId);

  if (error) {
    console.error(`updateOrderFulfilment(${orderId}) failed:`, error.message);
    return { error: error.message };
  }

  return { error: null };
}
