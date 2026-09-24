import type { FulfilmentStatus, PaymentStatus } from "@/types/order";
import type { WarehouseOrderStatus } from "@/types/warehouse-ops";

export type ConsolidationStatus =
  | "draft"
  | "ready"
  | "invoiced"
  | "fulfilled"
  | "cancelled";

export type InvoicePaymentLabel = "PAID" | "DUE";

export type ConsolidationOrderSummary = {
  id: string;
  order_number: string | null;
  customer_name: string;
  email: string | null;
  address: string | null;
  postcode: string | null;
  currency: string | null;
  payment_method: string | null;
  payment_status: PaymentStatus | null;
  fulfilment_status: FulfilmentStatus;
  warehouse_status: WarehouseOrderStatus;
  shipped_at: string | null;
  created_at: string | null;
  item_count: number;
  merchandise_total: number;
};

export type ConsolidationCandidateGroup = {
  match_key: string;
  customer_name: string;
  customer_email: string;
  delivery_address: string;
  postcode: string | null;
  currency: string;
  order_count: number;
  order_numbers: string[];
  item_count: number;
  merchandise_total: number;
  delivery_total: number;
  delivery_review_required: boolean;
  payment_statuses: string[];
  orders: ConsolidationOrderSummary[];
};

export type OrderConsolidationRecord = {
  id: string;
  organization_id: string;
  consolidation_number: string;
  currency: string;
  customer_name: string;
  customer_email: string;
  delivery_address_snapshot: string;
  postcode_snapshot: string | null;
  match_key: string;
  status: ConsolidationStatus;
  delivery_review_required: boolean;
  merchandise_total: number;
  delivery_total: number;
  discount_total: number;
  vat_total: number;
  grand_total: number;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  order_numbers?: string[];
  order_count?: number;
  item_count?: number;
  orders?: ConsolidationOrderSummary[];
  invoice?: OrderInvoiceRecord | null;
};

export type InvoiceLineSnapshot = {
  order_id: string;
  order_number: string | null;
  order_item_id: string;
  product_id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type OrderInvoiceRecord = {
  id: string;
  organization_id: string;
  consolidation_id: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  payment_status_label: InvoicePaymentLabel;
  merchandise_total: number;
  delivery_total: number;
  discount_total: number;
  vat_total: number;
  grand_total: number;
  order_numbers: string[];
  pdf_storage_path: string | null;
  payload: {
    customer_name: string;
    customer_email: string;
    delivery_address: string;
    postcode: string | null;
    phone: string | null;
    payment_method: string | null;
    lines: InvoiceLineSnapshot[];
    notes: string | null;
  };
  created_at: string;
  updated_at: string;
};

export type InvoiceDocumentData = {
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  paymentStatusLabel: InvoicePaymentLabel;
  paymentMethod: string | null;
  customerName: string;
  customerEmail: string;
  phone: string | null;
  deliveryAddress: string;
  postcode: string | null;
  orderReferences: string[];
  lines: {
    description: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  merchandiseTotal: number;
  deliveryTotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
  notes: string | null;
};
