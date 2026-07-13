export type Supplier = {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  lead_time_days: number | null;
  incoterms: string | null;
  bank_details: string | null;
  tax_number: string | null;
  preferred_freight: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string;
  name: string;
  country: string | null;
  supplier_id: string | null;
  website: string | null;
  logo_url: string | null;
  contract_status: string | null;
  exclusive_distributor: boolean;
  minimum_order_value: number | null;
  lead_time_days: number | null;
  created_at: string;
  supplier?: { name: string };
};

export type SupplierPerformance = {
  supplier_id: string;
  supplier_name: string;
  total_spend: number;
  orders_count: number;
  on_time_pct: number | null;
  late_deliveries: number;
  quality_issues: number;
  avg_lead_time_days: number | null;
};

export type ProcurementDashboardStats = {
  open_purchase_orders: number;
  goods_in_transit: number;
  awaiting_payment: number;
  outstanding_spend: number;
  inventory_incoming: number;
  spend_by_supplier: { supplier: string; spend: number }[];
  monthly_purchasing: { month: string; spend: number }[];
};
