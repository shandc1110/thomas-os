export type POStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "manufacturing"
  | "ready"
  | "shipped"
  | "delivered"
  | "received"
  | "closed"
  | "cancelled";

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  confirmed: "Confirmed",
  manufacturing: "Manufacturing",
  ready: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  supplier_id: string;
  status: POStatus;
  currency: string | null;
  issue_date: string | null;
  expected_ship_date: string | null;
  expected_arrival: string | null;
  expected_payment: string | null;
  incoterms: string | null;
  freight_method: string | null;
  container_number: string | null;
  tracking_number: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  import_costs: number;
  duty: number;
  vat: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: { name: string };
  lines?: PurchaseOrderLine[];
};

export type PurchaseOrderLine = {
  id: string;
  purchase_order_id: string;
  product_id: string | number | null;
  sku: string | null;
  product_name: string;
  quantity: number;
  quantity_received: number;
  unit_cost: number;
  discount: number;
  line_total: number;
};

export type InboundShipment = {
  id: string;
  shipment_number: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  freight_method: string | null;
  forwarder: string | null;
  container_number: string | null;
  tracking_number: string | null;
  departure_date: string | null;
  arrival_date: string | null;
  eta: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  purchase_order?: { po_number: string };
  supplier?: { name: string };
};
