export type WarehouseOrderStatus =
  | "pending"
  | "picking"
  | "picked"
  | "packing"
  | "packed"
  | "awaiting_label"
  | "ready_to_ship"
  | "shipped"
  | "delivered"
  | "cancelled";

export const WAREHOUSE_STATUS_LABELS: Record<WarehouseOrderStatus, string> = {
  pending: "Pending",
  picking: "Picking",
  picked: "Picked",
  packing: "Packing",
  packed: "Packed",
  awaiting_label: "Awaiting Label",
  ready_to_ship: "Ready to Ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export type WarehouseDashboardStats = {
  orders_waiting: number;
  picking: number;
  packing: number;
  ready_to_ship: number;
  completed_today: number;
  backorders: number;
  recent_activity: WarehouseEvent[];
  performance: WarehousePerformance;
};

export type WarehousePerformance = {
  avg_pick_time_minutes: number | null;
  avg_pack_time_minutes: number | null;
  orders_per_hour: number | null;
  picking_accuracy_pct: number | null;
  packing_accuracy_pct: number | null;
  inventory_errors: number;
};

export type WarehouseEvent = {
  id: string;
  event_type: string;
  order_id: string | number | null;
  user_name: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  order_number?: string | null;
};

export type PickList = {
  id: string;
  pick_list_number: string;
  order_id: string | number;
  status: string;
  picked_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  lines?: PickLine[];
  order_number?: string | null;
  customer_name?: string | null;
};

export type PickLine = {
  id: string;
  pick_list_id: string;
  order_item_id: string | number | null;
  product_id: string | number;
  location_id: string | null;
  location_code: string;
  sku: string | null;
  product_name: string;
  quantity_required: number;
  quantity_picked: number;
  status: "pending" | "picked" | "short" | "damaged" | "missing";
  issue_type: string | null;
  issue_notes: string | null;
};

export type PackSession = {
  id: string;
  order_id: string | number;
  status: string;
  packed_by: string | null;
  packing_slip_printed: boolean;
  label_printed: boolean;
  started_at: string;
  completed_at: string | null;
  verifications?: PackVerification[];
  order_number?: string | null;
};

export type PackVerification = {
  id: string;
  pack_session_id: string;
  product_id: string | number;
  sku: string | null;
  expected_quantity: number;
  verified_quantity: number;
  status: "pending" | "ok" | "mismatch";
  verified_at: string | null;
  product_name?: string;
};
