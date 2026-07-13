import type { WarehouseOrderStatus } from "@/types/warehouse-ops";

export type FulfilmentStatus = "pending" | "ready" | "fulfilled";

export type OrderRecord = {
  id: string | number;
  order_number: string | null;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  wechat_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  postcode: string | null;
  payment_method: string | null;
  currency: string | null;
  notes: string | null;
  total_weight_grams: number | null;
  shopify_draft_order_id: string | null;
  fulfilment_status: FulfilmentStatus;
  warehouse_status: WarehouseOrderStatus;
  tracking_number: string | null;
  shipped_at: string | null;
  picked_at: string | null;
  packed_at: string | null;
  created_at: string | null;
};

export type OrderItemRecord = {
  id: string | number;
  order_id: string | number;
  product_id: string | number;
  quantity: number;
  price: number;
  product_name: string;
  product_sku: string | null;
  product_weight_grams: number | null;
};

export type OrderWithItems = OrderRecord & {
  items: OrderItemRecord[];
  total: number;
  shopify_admin_url: string | null;
};

export type OrderListItem = OrderRecord & {
  total: number;
  item_count: number;
};

export type PackingSlipData = {
  orderNumber: string;
  firstName: string;
  lastName: string;
  customerName: string;
  address: string;
  postcode: string;
  phone: string;
  wechatId: string;
  paymentMethod: string;
  currency: string;
  notes: string | null;
  items: {
    name: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  subtotal: number;
  grandTotal: number;
  totalWeightGrams: number;
  createdAt: string | null;
};
