import type { StockMovement } from "./movement";

export type ProductStatus = "active" | "draft" | "discontinued";

export type ProductMaster = {
  id: string | number;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  barcode: string | null;
  weight_grams: number | null;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  country_of_origin: string | null;
  hs_code: string | null;
  cost_price: number | null;
  wholesale_price: number | null;
  retail_price: number | null;
  price: number | null;
  currency: string | null;
  status: ProductStatus | null;
  active: boolean | null;
  image_url: string | null;
  gallery_images: string[];
  tags: string[];
  low_stock_threshold: number | null;
  stock: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InventoryBalance = {
  id: string;
  product_id: string | number;
  warehouse_id: string;
  location_id: string;
  available: number;
  allocated: number;
  reserved: number;
  incoming: number;
  damaged: number;
  returned: number;
  on_order: number;
  total: number;
  last_updated: string;
  warehouse?: { code: string; name: string };
  location?: { code: string; name: string };
};

export type InventoryDashboardStats = {
  total_products: number;
  total_skus: number;
  inventory_value: number;
  available_units: number;
  incoming_units: number;
  allocated_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  by_brand: { brand: string; units: number; value: number }[];
  recent_movements: StockMovement[];
};

export type InventoryAlert = {
  id: string;
  alert_type: string;
  product_id: string | number | null;
  message: string;
  severity: "info" | "warning" | "critical";
  acknowledged: boolean;
  created_at: string;
  product?: { sku: string | null; name: string };
};

export type ProductLedgerEntry = {
  date: string;
  movement_number: string;
  movement_type: string;
  description: string;
  quantity: number;
  balance: number;
  reference: string | null;
  notes: string | null;
};
