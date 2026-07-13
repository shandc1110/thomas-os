import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supplier, Brand, SupplierPerformance, ProcurementDashboardStats } from "@/types/supplier";
import type { PurchaseOrder, PurchaseOrderLine, POStatus } from "@/types/purchase-order";
import type { InboundShipment } from "@/types/purchase-order";

export async function listSuppliers(
  supabase: SupabaseClient,
): Promise<{ suppliers: Supplier[]; error: string | null }> {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) return { suppliers: [], error: error.message };
  return { suppliers: (data ?? []) as Supplier[], error: null };
}

export async function upsertSupplier(
  supabase: SupabaseClient,
  input: Partial<Supplier> & { name: string },
): Promise<{ supplier: Supplier | null; error: string | null }> {
  const payload = { ...input, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("suppliers")
    .upsert(payload, input.id ? { onConflict: "id" } : undefined)
    .select()
    .single();
  if (error) return { supplier: null, error: error.message };
  return { supplier: data as Supplier, error: null };
}

export async function listBrands(
  supabase: SupabaseClient,
): Promise<{ brands: Brand[]; error: string | null }> {
  const { data, error } = await supabase
    .from("brands")
    .select("*, suppliers ( name )")
    .order("name");
  if (error) return { brands: [], error: error.message };
  return {
    brands: (data ?? []).map((b) => ({
      ...(b as Brand),
      supplier: (b as { suppliers?: { name: string } }).suppliers,
    })),
    error: null,
  };
}

export async function upsertBrand(
  supabase: SupabaseClient,
  input: Partial<Brand> & { name: string },
): Promise<{ brand: Brand | null; error: string | null }> {
  const { data, error } = await supabase
    .from("brands")
    .upsert(input, { onConflict: "name" })
    .select()
    .single();
  if (error) return { brand: null, error: error.message };
  return { brand: data as Brand, error: null };
}

async function allocatePoNumber(supabase: SupabaseClient): Promise<string> {
  const { count } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true });
  return `PO-${String((count ?? 0) + 1).padStart(6, "0")}`;
}

export async function createPurchaseOrder(
  supabase: SupabaseClient,
  input: {
    supplier_id: string;
    currency?: string;
    issue_date?: string;
    expected_arrival?: string;
    incoterms?: string;
    freight_method?: string;
    notes?: string;
    lines: {
      product_id?: string | number;
      sku?: string;
      product_name: string;
      quantity: number;
      unit_cost: number;
      discount?: number;
    }[];
  },
): Promise<{ po: PurchaseOrder | null; error: string | null }> {
  const poNumber = await allocatePoNumber(supabase);

  let subtotal = 0;
  const lineRows = input.lines.map((l) => {
    const lineTotal = l.quantity * l.unit_cost - (l.discount ?? 0);
    subtotal += lineTotal;
    return {
      sku: l.sku ?? null,
      product_id: l.product_id ?? null,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_cost: l.unit_cost,
      discount: l.discount ?? 0,
      line_total: lineTotal,
    };
  });

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      po_number: poNumber,
      supplier_id: input.supplier_id,
      currency: input.currency ?? "CNY",
      issue_date: input.issue_date ?? new Date().toISOString().slice(0, 10),
      expected_arrival: input.expected_arrival ?? null,
      incoterms: input.incoterms ?? null,
      freight_method: input.freight_method ?? null,
      notes: input.notes ?? null,
      subtotal,
      total: subtotal,
      status: "draft",
    })
    .select()
    .single();

  if (poErr || !po) return { po: null, error: poErr?.message ?? "Failed to create PO." };

  await supabase.from("purchase_order_lines").insert(
    lineRows.map((l) => ({ ...l, purchase_order_id: po.id })),
  );

  return getPurchaseOrder(supabase, po.id as string);
}

export async function getPurchaseOrder(
  supabase: SupabaseClient,
  poId: string,
): Promise<{ po: PurchaseOrder | null; error: string | null }> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(`*, suppliers ( name ), purchase_order_lines ( * )`)
    .eq("id", poId)
    .single();

  if (error) return { po: null, error: error.message };

  return {
    po: {
      ...(data as PurchaseOrder),
      supplier: (data as { suppliers?: { name: string } }).suppliers,
      lines: (data as { purchase_order_lines?: PurchaseOrderLine[] }).purchase_order_lines,
    },
    error: null,
  };
}

export async function updatePOStatus(
  supabase: SupabaseClient,
  poId: string,
  status: POStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", poId);
  return { error: error?.message ?? null };
}

export async function listPurchaseOrders(
  supabase: SupabaseClient,
  status?: string,
): Promise<{ orders: PurchaseOrder[]; error: string | null }> {
  let query = supabase
    .from("purchase_orders")
    .select("*, suppliers ( name )")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return { orders: [], error: error.message };

  return {
    orders: (data ?? []).map((po) => ({
      ...(po as PurchaseOrder),
      supplier: (po as { suppliers?: { name: string } }).suppliers,
    })),
    error: null,
  };
}

export async function receivePurchaseOrder(
  supabase: SupabaseClient,
  input: {
    purchase_order_id: string;
    warehouse_id: string;
    location_id: string;
    lines: { line_id: string; quantity_received: number }[];
    received_by?: string;
  },
): Promise<{ error: string | null }> {
  const { po } = await getPurchaseOrder(supabase, input.purchase_order_id);
  if (!po) return { error: "PO not found." };

  const receiveLines: { product_id: string | number; quantity_expected: number; quantity_received: number }[] = [];

  for (const rl of input.lines) {
    const line = po.lines?.find((l) => l.id === rl.line_id);
    if (!line || rl.quantity_received <= 0) continue;

    const newReceived = line.quantity_received + rl.quantity_received;
    await supabase
      .from("purchase_order_lines")
      .update({ quantity_received: newReceived })
      .eq("id", rl.line_id);

    if (line.product_id) {
      receiveLines.push({
        product_id: line.product_id,
        quantity_expected: line.quantity - line.quantity_received,
        quantity_received: rl.quantity_received,
      });

      // Update landed cost on product
      const landedCost = line.unit_cost;
      await supabase
        .from("products")
        .update({
          factory_cost: line.unit_cost,
          cost_price: landedCost,
          landed_cost: landedCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", line.product_id);
    }
  }

  const { receiveGoods } = await import("@/lib/inventory/receive");
  const { error: recvErr } = await receiveGoods(supabase, {
    warehouse_id: input.warehouse_id,
    location_id: input.location_id,
    po_reference: po.po_number,
    received_by: input.received_by,
    lines: receiveLines,
  });

  if (recvErr) return { error: recvErr };

  await supabase
    .from("goods_receipts")
    .update({ purchase_order_id: input.purchase_order_id })
    .eq("po_reference", po.po_number);

  const allReceived = po.lines?.every((l) => {
    const rl = input.lines.find((r) => r.line_id === l.id);
    const added = rl?.quantity_received ?? 0;
    return l.quantity_received + added >= l.quantity;
  });

  await updatePOStatus(supabase, input.purchase_order_id, allReceived ? "received" : "delivered");

  return { error: null };
}

export function calculateLandedCost(product: {
  factory_cost?: number | null;
  shipping_cost?: number | null;
  duty_cost?: number | null;
  vat_cost?: number | null;
  import_fees?: number | null;
  handling_cost?: number | null;
}): number {
  return (
    (product.factory_cost ?? 0) +
    (product.shipping_cost ?? 0) +
    (product.duty_cost ?? 0) +
    (product.vat_cost ?? 0) +
    (product.import_fees ?? 0) +
    (product.handling_cost ?? 0)
  );
}

export async function getProcurementDashboard(
  supabase: SupabaseClient,
): Promise<{ stats: ProcurementDashboardStats | null; error: string | null }> {
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select("status, total, supplier_id, suppliers ( name ), created_at");

  const poList = pos ?? [];
  const open = poList.filter((p) =>
    !["received", "closed", "cancelled"].includes(p.status as string),
  ).length;

  const { count: inTransit } = await supabase
    .from("inbound_shipments")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "in_transit"]);

  const outstanding = poList
    .filter((p) => !["received", "closed", "cancelled"].includes(p.status as string))
    .reduce((s, p) => s + Number(p.total ?? 0), 0);

  const { data: balances } = await supabase
    .from("inventory_balances")
    .select("incoming");
  const incoming = (balances ?? []).reduce((s, b) => s + ((b.incoming as number) ?? 0), 0);

  const supplierSpend = new Map<string, number>();
  for (const po of poList) {
    const suppliers = (po as { suppliers?: { name: string } | { name: string }[] | null }).suppliers;
    const name = Array.isArray(suppliers) ? suppliers[0]?.name : suppliers?.name;
    supplierSpend.set(name ?? "Unknown", (supplierSpend.get(name ?? "Unknown") ?? 0) + Number(po.total ?? 0));
  }

  const monthlyMap = new Map<string, number>();
  for (const po of poList) {
    const month = (po.created_at as string).slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + Number(po.total ?? 0));
  }

  return {
    stats: {
      open_purchase_orders: open,
      goods_in_transit: inTransit ?? 0,
      awaiting_payment: poList.filter((p) => p.status === "delivered").length,
      outstanding_spend: outstanding,
      inventory_incoming: incoming,
      spend_by_supplier: [...supplierSpend.entries()]
        .map(([supplier, spend]) => ({ supplier, spend }))
        .sort((a, b) => b.spend - a.spend),
      monthly_purchasing: [...monthlyMap.entries()]
        .map(([month, spend]) => ({ month, spend }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    },
    error: null,
  };
}

export async function createInboundShipment(
  supabase: SupabaseClient,
  input: Partial<InboundShipment> & { purchase_order_id?: string; supplier_id?: string },
): Promise<{ shipment: InboundShipment | null; error: string | null }> {
  const { count } = await supabase
    .from("inbound_shipments")
    .select("id", { count: "exact", head: true });

  const { data, error } = await supabase
    .from("inbound_shipments")
    .insert({
      shipment_number: `SHP-${String((count ?? 0) + 1).padStart(6, "0")}`,
      ...input,
    })
    .select()
    .single();

  if (error) return { shipment: null, error: error.message };
  return { shipment: data as InboundShipment, error: null };
}

export async function listShipments(
  supabase: SupabaseClient,
): Promise<{ shipments: InboundShipment[]; error: string | null }> {
  const { data, error } = await supabase
    .from("inbound_shipments")
    .select("*, purchase_orders ( po_number ), suppliers ( name )")
    .order("created_at", { ascending: false });

  if (error) return { shipments: [], error: error.message };

  return {
    shipments: (data ?? []).map((s) => ({
      ...(s as InboundShipment),
      purchase_order: (s as { purchase_orders?: { po_number: string } }).purchase_orders,
      supplier: (s as { suppliers?: { name: string } }).suppliers,
    })),
    error: null,
  };
}
