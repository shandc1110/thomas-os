import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertSameMatchKey,
  findConsolidationCandidates,
  isOrderEligibleForConsolidation,
  round2,
  type CandidateOrderInput,
} from "@/lib/orders/consolidation-core";
import {
  buildConsolidationMatchKey,
  normalizeCurrency,
  normalizeEmail,
} from "@/lib/orders/consolidation-normalize";
import type {
  ConsolidationCandidateGroup,
  ConsolidationStatus,
  OrderConsolidationRecord,
  OrderInvoiceRecord,
} from "@/types/consolidation";
import type { FulfilmentStatus, PaymentStatus } from "@/types/order";
import type { WarehouseOrderStatus } from "@/types/warehouse-ops";

type OrderRow = {
  id: string;
  order_number: string | null;
  customer_name: string;
  email: string | null;
  address: string | null;
  postcode: string | null;
  currency: string | null;
  payment_method: string | null;
  payment_status?: string | null;
  fulfilment_status: string;
  warehouse_status: string;
  shipped_at: string | null;
  created_at: string | null;
  phone?: string | null;
  order_items?: { id: string; quantity: number; price: number }[];
};

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return Boolean(error.message?.toLowerCase().includes("does not exist"));
}

function mapCandidate(row: OrderRow, already: boolean): CandidateOrderInput {
  const items = row.order_items ?? [];
  const merchandise_total = round2(
    items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0),
  );
  const item_count = items.reduce((s, i) => s + Number(i.quantity), 0);
  return {
    id: row.id,
    order_number: row.order_number,
    customer_name: row.customer_name,
    email: row.email,
    address: row.address,
    postcode: row.postcode,
    currency: row.currency,
    payment_method: row.payment_method,
    payment_status: (row.payment_status as PaymentStatus | null | undefined) ?? null,
    fulfilment_status: (row.fulfilment_status as FulfilmentStatus) ?? "pending",
    warehouse_status: (row.warehouse_status as WarehouseOrderStatus) ?? "pending",
    shipped_at: row.shipped_at,
    created_at: row.created_at,
    item_count,
    merchandise_total,
    already_consolidated: already,
  };
}

async function loadConsolidatedOrderIds(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Set<string>> {
  const { data: cons } = await supabase
    .from("order_consolidations")
    .select("id")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled");

  const consIds = (cons ?? []).map((c) => c.id as string);
  if (consIds.length === 0) return new Set();

  const { data: links } = await supabase
    .from("order_consolidation_orders")
    .select("order_id")
    .in("consolidation_id", consIds);

  return new Set((links ?? []).map((l) => l.order_id as string));
}

async function fetchOrdersForOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ rows: OrderRow[]; error: string | null }> {
  const selectWithPayment = `
    id, order_number, customer_name, email, address, postcode, currency,
    payment_method, payment_status, fulfilment_status, warehouse_status,
    shipped_at, created_at, phone,
    order_items ( id, quantity, price )
  `;
  const selectWithoutPayment = `
    id, order_number, customer_name, email, address, postcode, currency,
    payment_method, fulfilment_status, warehouse_status,
    shipped_at, created_at, phone,
    order_items ( id, quantity, price )
  `;

  let result: {
    data: OrderRow[] | null;
    error: { code?: string; message?: string } | null;
  } = await supabase
    .from("orders")
    .select(selectWithPayment)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (result.error && isMissingColumnError(result.error)) {
    result = await supabase
      .from("orders")
      .select(selectWithoutPayment)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
  }

  if (result.error) {
    return { rows: [], error: result.error.message ?? "Query failed." };
  }
  return { rows: (result.data ?? []) as OrderRow[], error: null };
}

export async function listConsolidationCandidates(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ groups: ConsolidationCandidateGroup[]; error: string | null }> {
  const { rows, error } = await fetchOrdersForOrg(supabase, organizationId);
  if (error) return { groups: [], error };

  const consolidated = await loadConsolidatedOrderIds(supabase, organizationId);
  const inputs = rows.map((r) => mapCandidate(r, consolidated.has(r.id)));
  return { groups: findConsolidationCandidates(inputs), error: null };
}

function formatPeriod(d = new Date()): string {
  const y = d.getUTCFullYear().toString().slice(-2);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

async function allocateConsolidationNumber(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string> {
  const period = formatPeriod();
  const prefix = `CNS-${period}-`;
  const { data } = await supabase
    .from("order_consolidations")
    .select("consolidation_number")
    .eq("organization_id", organizationId)
    .like("consolidation_number", `${prefix}%`)
    .order("consolidation_number", { ascending: false })
    .limit(20);

  let max = 0;
  for (const row of data ?? []) {
    const num = row.consolidation_number as string;
    const match = num.match(new RegExp(`^CNS-${period}-(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function createConsolidationFromOrderIds(
  supabase: SupabaseClient,
  organizationId: string,
  orderIds: string[],
): Promise<{ consolidation: OrderConsolidationRecord | null; error: string | null }> {
  const uniqueIds = [...new Set(orderIds.map(String))];
  if (uniqueIds.length < 2) {
    return { consolidation: null, error: "At least two orders are required." };
  }

  const { rows, error } = await fetchOrdersForOrg(supabase, organizationId);
  if (error) return { consolidation: null, error };

  const byId = new Map(rows.map((r) => [r.id, r]));
  const selected: OrderRow[] = [];
  for (const id of uniqueIds) {
    const row = byId.get(id);
    if (!row) return { consolidation: null, error: `Order not found: ${id}` };
    selected.push(row);
  }

  const consolidated = await loadConsolidatedOrderIds(supabase, organizationId);
  const inputs = selected.map((r) => mapCandidate(r, consolidated.has(r.id)));
  for (const input of inputs) {
    if (input.already_consolidated) {
      return {
        consolidation: null,
        error: `Order ${input.order_number ?? input.id} is already in a consolidation.`,
      };
    }
  }

  const check = assertSameMatchKey(inputs.map((i) => ({ ...i, already_consolidated: false })));
  if (!check.ok) return { consolidation: null, error: check.error };

  for (const input of inputs) {
    if (!isOrderEligibleForConsolidation({ ...input, already_consolidated: false })) {
      return {
        consolidation: null,
        error: `Order ${input.order_number ?? input.id} is not eligible.`,
      };
    }
  }

  const merchandise_total = round2(
    inputs.reduce((s, o) => s + o.merchandise_total, 0),
  );
  const first = selected[0]!;
  const consolidation_number = await allocateConsolidationNumber(supabase, organizationId);
  const match_key = check.matchKey;
  const now = new Date().toISOString();

  const insertPayload = {
    organization_id: organizationId,
    consolidation_number,
    currency: normalizeCurrency(first.currency),
    customer_name: first.customer_name.replace(/\s+/g, " ").trim(),
    customer_email: normalizeEmail(first.email),
    delivery_address_snapshot: (first.address ?? "").trim(),
    postcode_snapshot: first.postcode?.trim() || null,
    match_key,
    status: "draft" as ConsolidationStatus,
    delivery_review_required: true,
    merchandise_total,
    delivery_total: 0,
    discount_total: 0,
    vat_total: 0,
    grand_total: merchandise_total,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error: createErr } = await supabase
    .from("order_consolidations")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createErr || !created) {
    return { consolidation: null, error: createErr?.message ?? "Could not create consolidation." };
  }

  const links = uniqueIds.map((order_id) => ({
    consolidation_id: created.id as string,
    order_id,
  }));
  const { error: linkErr } = await supabase.from("order_consolidation_orders").insert(links);
  if (linkErr) {
    await supabase.from("order_consolidations").delete().eq("id", created.id);
    return { consolidation: null, error: linkErr.message };
  }

  return getConsolidationById(supabase, organizationId, created.id as string);
}

export async function listConsolidations(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ consolidations: OrderConsolidationRecord[]; error: string | null }> {
  const { data, error } = await supabase
    .from("order_consolidations")
    .select(
      `
      *,
      order_consolidation_orders (
        order_id,
        orders ( order_number, order_items ( quantity ) )
      ),
      order_invoices ( id, invoice_number, payment_status_label, pdf_storage_path, created_at )
    `,
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return { consolidations: [], error: error.message };

  const consolidations: OrderConsolidationRecord[] = (data ?? []).map((row) => {
    const links =
      (row.order_consolidation_orders as {
        order_id: string;
        orders: {
          order_number: string | null;
          order_items: { quantity: number }[] | null;
        } | null;
      }[]) ?? [];
    const order_numbers = links
      .map((l) => l.orders?.order_number)
      .filter((n): n is string => Boolean(n));
    const item_count = links.reduce(
      (s, l) =>
        s + (l.orders?.order_items ?? []).reduce((a, i) => a + Number(i.quantity), 0),
      0,
    );
    const invoiceJoin = row.order_invoices as
      | { id: string; invoice_number: string; payment_status_label: string; pdf_storage_path: string | null; created_at: string }
      | { id: string; invoice_number: string; payment_status_label: string; pdf_storage_path: string | null; created_at: string }[]
      | null;
    const inv = Array.isArray(invoiceJoin) ? invoiceJoin[0] : invoiceJoin;

    return {
      id: row.id as string,
      organization_id: row.organization_id as string,
      consolidation_number: row.consolidation_number as string,
      currency: row.currency as string,
      customer_name: row.customer_name as string,
      customer_email: row.customer_email as string,
      delivery_address_snapshot: row.delivery_address_snapshot as string,
      postcode_snapshot: (row.postcode_snapshot as string | null) ?? null,
      match_key: row.match_key as string,
      status: row.status as ConsolidationStatus,
      delivery_review_required: Boolean(row.delivery_review_required),
      merchandise_total: Number(row.merchandise_total),
      delivery_total: Number(row.delivery_total),
      discount_total: Number(row.discount_total),
      vat_total: Number(row.vat_total),
      grand_total: Number(row.grand_total),
      invoice_id: (row.invoice_id as string | null) ?? inv?.id ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      order_numbers,
      order_count: links.length,
      item_count,
      invoice: inv
        ? ({
            id: inv.id,
            organization_id: organizationId,
            consolidation_id: row.id as string,
            invoice_number: inv.invoice_number,
            invoice_date: "",
            currency: row.currency as string,
            payment_status_label: inv.payment_status_label as "PAID" | "DUE",
            merchandise_total: Number(row.merchandise_total),
            delivery_total: Number(row.delivery_total),
            discount_total: Number(row.discount_total),
            vat_total: Number(row.vat_total),
            grand_total: Number(row.grand_total),
            order_numbers,
            pdf_storage_path: inv.pdf_storage_path,
            payload: {
              customer_name: row.customer_name as string,
              customer_email: row.customer_email as string,
              delivery_address: row.delivery_address_snapshot as string,
              postcode: (row.postcode_snapshot as string | null) ?? null,
              phone: null,
              payment_method: null,
              lines: [],
              notes: null,
            },
            created_at: inv.created_at,
            updated_at: inv.created_at,
          })
        : null,
    };
  });

  return { consolidations, error: null };
}

export async function getConsolidationById(
  supabase: SupabaseClient,
  organizationId: string,
  consolidationId: string,
): Promise<{ consolidation: OrderConsolidationRecord | null; error: string | null }> {
  const { data, error } = await supabase
    .from("order_consolidations")
    .select(
      `
      *,
      order_consolidation_orders ( order_id ),
      order_invoices ( * )
    `,
    )
    .eq("organization_id", organizationId)
    .eq("id", consolidationId)
    .maybeSingle();

  if (error) return { consolidation: null, error: error.message };
  if (!data) return { consolidation: null, error: "Consolidation not found." };

  const orderIds = (
    (data.order_consolidation_orders as { order_id: string }[]) ?? []
  ).map((l) => l.order_id);

  const { rows } = await fetchOrdersForOrg(supabase, organizationId);
  const orderMap = new Map(rows.map((r) => [r.id, r]));
  const orderSummaries = orderIds
    .map((id) => orderMap.get(id))
    .filter((r): r is OrderRow => Boolean(r))
    .map((r) => mapCandidate(r, true));

  const invJoin = data.order_invoices as Record<string, unknown> | Record<string, unknown>[] | null;
  const inv = Array.isArray(invJoin) ? invJoin[0] : invJoin;

  return {
    consolidation: {
      id: data.id as string,
      organization_id: data.organization_id as string,
      consolidation_number: data.consolidation_number as string,
      currency: data.currency as string,
      customer_name: data.customer_name as string,
      customer_email: data.customer_email as string,
      delivery_address_snapshot: data.delivery_address_snapshot as string,
      postcode_snapshot: (data.postcode_snapshot as string | null) ?? null,
      match_key: data.match_key as string,
      status: data.status as ConsolidationStatus,
      delivery_review_required: Boolean(data.delivery_review_required),
      merchandise_total: Number(data.merchandise_total),
      delivery_total: Number(data.delivery_total),
      discount_total: Number(data.discount_total),
      vat_total: Number(data.vat_total),
      grand_total: Number(data.grand_total),
      invoice_id: (data.invoice_id as string | null) ?? (inv?.id as string | undefined) ?? null,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      order_numbers: orderSummaries.map((o) => o.order_number ?? o.id),
      order_count: orderSummaries.length,
      item_count: orderSummaries.reduce((s, o) => s + o.item_count, 0),
      orders: orderSummaries.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        email: o.email,
        address: o.address,
        postcode: o.postcode,
        currency: o.currency,
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        fulfilment_status: o.fulfilment_status,
        warehouse_status: o.warehouse_status,
        shipped_at: o.shipped_at,
        created_at: o.created_at,
        item_count: o.item_count,
        merchandise_total: o.merchandise_total,
      })),
      invoice: inv
        ? {
            id: inv.id as string,
            organization_id: inv.organization_id as string,
            consolidation_id: inv.consolidation_id as string,
            invoice_number: inv.invoice_number as string,
            invoice_date: String(inv.invoice_date),
            currency: inv.currency as string,
            payment_status_label: inv.payment_status_label as "PAID" | "DUE",
            merchandise_total: Number(inv.merchandise_total),
            delivery_total: Number(inv.delivery_total),
            discount_total: Number(inv.discount_total),
            vat_total: Number(inv.vat_total),
            grand_total: Number(inv.grand_total),
            order_numbers: (inv.order_numbers as string[]) ?? [],
            pdf_storage_path: (inv.pdf_storage_path as string | null) ?? null,
            payload: (inv.payload as OrderInvoiceRecord["payload"]) ?? {
              customer_name: data.customer_name as string,
              customer_email: data.customer_email as string,
              delivery_address: data.delivery_address_snapshot as string,
              postcode: (data.postcode_snapshot as string | null) ?? null,
              phone: null,
              payment_method: null,
              lines: [],
              notes: null,
            },
            created_at: inv.created_at as string,
            updated_at: inv.updated_at as string,
          }
        : null,
    },
    error: null,
  };
}

export async function removeOrderFromConsolidation(
  supabase: SupabaseClient,
  organizationId: string,
  consolidationId: string,
  orderId: string,
): Promise<{ consolidation: OrderConsolidationRecord | null; error: string | null }> {
  const { consolidation, error } = await getConsolidationById(
    supabase,
    organizationId,
    consolidationId,
  );
  if (error || !consolidation) return { consolidation: null, error: error ?? "Not found." };
  if (consolidation.status !== "draft") {
    return { consolidation: null, error: "Only draft consolidations can be edited." };
  }

  const { error: delErr } = await supabase
    .from("order_consolidation_orders")
    .delete()
    .eq("consolidation_id", consolidationId)
    .eq("order_id", orderId);
  if (delErr) return { consolidation: null, error: delErr.message };

  const remaining = (consolidation.orders ?? []).filter((o) => o.id !== orderId);
  const merchandise_total = round2(
    remaining.reduce((s, o) => s + o.merchandise_total, 0),
  );

  await supabase
    .from("order_consolidations")
    .update({
      merchandise_total,
      grand_total: merchandise_total,
      delivery_review_required: remaining.length >= 2,
      updated_at: new Date().toISOString(),
    })
    .eq("id", consolidationId)
    .eq("organization_id", organizationId);

  return getConsolidationById(supabase, organizationId, consolidationId);
}

export async function updateConsolidationStatus(
  supabase: SupabaseClient,
  organizationId: string,
  consolidationId: string,
  status: ConsolidationStatus,
): Promise<{ consolidation: OrderConsolidationRecord | null; error: string | null }> {
  const { error } = await supabase
    .from("order_consolidations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", consolidationId)
    .eq("organization_id", organizationId);
  if (error) return { consolidation: null, error: error.message };
  return getConsolidationById(supabase, organizationId, consolidationId);
}

export { findConsolidationCandidates, buildConsolidationMatchKey };
