export type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string;
  locations?: WarehouseLocation[];
};

export type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  code: string;
  name: string | null;
  active: boolean;
  created_at: string;
};

export type GoodsReceipt = {
  id: string;
  receipt_number: string;
  po_reference: string | null;
  warehouse_id: string;
  location_id: string;
  status: string;
  notes: string | null;
  received_by: string | null;
  created_at: string;
  lines?: GoodsReceiptLine[];
  warehouse?: { code: string; name: string };
  location?: { code: string; name: string };
};

export type GoodsReceiptLine = {
  id: string;
  receipt_id: string;
  product_id: string | number;
  quantity_expected: number;
  quantity_received: number;
  product?: { sku: string | null; name: string };
};

export type StockTakeSession = {
  id: string;
  session_number: string;
  warehouse_id: string;
  status: "in_progress" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  started_by: string | null;
  lines?: StockTakeLine[];
  warehouse?: { code: string; name: string };
};

export type StockTakeLine = {
  id: string;
  session_id: string;
  product_id: string | number;
  location_id: string;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  approved: boolean;
  created_at: string;
  product?: { sku: string | null; name: string; barcode: string | null };
  location?: { code: string; name: string };
};
