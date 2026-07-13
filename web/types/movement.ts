export type MovementType =
  | "opening_balance"
  | "goods_received"
  | "customer_order"
  | "return"
  | "damaged"
  | "lost"
  | "adjustment"
  | "transfer"
  | "stock_take";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  opening_balance: "Opening Balance",
  goods_received: "Goods Received",
  customer_order: "Customer Order",
  return: "Return",
  damaged: "Damaged",
  lost: "Lost",
  adjustment: "Adjustment",
  transfer: "Transfer",
  stock_take: "Stock Take",
};

export type StockMovement = {
  id: string;
  movement_number: string;
  movement_type: MovementType;
  product_id: string | number;
  sku: string | null;
  quantity: number;
  warehouse_id: string | null;
  location_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  notes: string | null;
  user_name: string | null;
  balance_after: number | null;
  created_at: string;
  product?: { name: string; sku: string | null };
  warehouse?: { code: string; name: string };
  location?: { code: string; name: string };
};

export type CreateMovementInput = {
  movement_type: MovementType;
  product_id: string | number;
  quantity: number;
  warehouse_id: string;
  location_id: string;
  reference_type?: string;
  reference_id?: string;
  reason?: string;
  notes?: string;
  user_name?: string;
  /** Which balance bucket to affect (default: available) */
  bucket?: "available" | "damaged" | "returned" | "incoming" | "allocated" | "reserved" | "on_order";
};
