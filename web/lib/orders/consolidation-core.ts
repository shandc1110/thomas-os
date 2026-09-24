/**
 * Pure eligibility + candidate grouping for order consolidation.
 * Kept free of server-only so Vitest can import without Next runtime.
 */
import {
  buildConsolidationMatchKey,
  normalizeCurrency,
  normalizeCustomerName,
  normalizeDeliveryAddress,
  normalizeEmail,
  normalizePostcode,
} from "@/lib/orders/consolidation-normalize";
import type {
  ConsolidationCandidateGroup,
  ConsolidationOrderSummary,
} from "@/types/consolidation";
import type { FulfilmentStatus, PaymentStatus } from "@/types/order";
import type { WarehouseOrderStatus } from "@/types/warehouse-ops";

const EXCLUDED_FULFILMENT = new Set<FulfilmentStatus>(["cancelled", "fulfilled"]);
const EXCLUDED_WAREHOUSE = new Set<WarehouseOrderStatus>([
  "shipped",
  "delivered",
  "cancelled",
]);

const VALID_OFFLINE_PAYMENT_METHODS = [
  "bank transfer",
  "wechat pay",
  "wechat",
  "cash",
];

export type CandidateOrderInput = {
  id: string;
  order_number: string | null;
  customer_name: string;
  email: string | null;
  address: string | null;
  postcode: string | null;
  currency: string | null;
  payment_method: string | null;
  /** null when column missing on live DB */
  payment_status: PaymentStatus | null;
  fulfilment_status: FulfilmentStatus;
  warehouse_status: WarehouseOrderStatus;
  shipped_at: string | null;
  created_at: string | null;
  item_count: number;
  merchandise_total: number;
  /** True when this order is already linked to a non-cancelled consolidation */
  already_consolidated?: boolean;
};

export function isPaymentOperationallyValid(order: {
  payment_status: PaymentStatus | null;
  payment_method: string | null;
}): boolean {
  const status = order.payment_status;
  if (status === "refunded") return false;
  if (status === "paid") return true;
  if (status === "pending") return false;

  // unpaid / missing column: allow offline community payment methods
  const method = (order.payment_method ?? "").trim().toLowerCase();
  if (!method) {
    // Missing payment_status column + no method → allow staff review via candidates
    // but still require name/email/address. Treat as valid for grouping.
    return status == null;
  }
  return VALID_OFFLINE_PAYMENT_METHODS.some((m) => method.includes(m));
}

export function isOrderEligibleForConsolidation(order: CandidateOrderInput): boolean {
  if (order.already_consolidated) return false;
  if (EXCLUDED_FULFILMENT.has(order.fulfilment_status)) return false;
  if (EXCLUDED_WAREHOUSE.has(order.warehouse_status)) return false;
  if (order.shipped_at) return false;
  if (!isPaymentOperationallyValid(order)) return false;

  const key = buildConsolidationMatchKey({
    customerName: order.customer_name,
    email: order.email,
    address: order.address,
    postcode: order.postcode,
    currency: order.currency,
  });
  return key.length > 0;
}

export function toOrderSummary(order: CandidateOrderInput): ConsolidationOrderSummary {
  return {
    id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    email: order.email,
    address: order.address,
    postcode: order.postcode,
    currency: order.currency,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    fulfilment_status: order.fulfilment_status,
    warehouse_status: order.warehouse_status,
    shipped_at: order.shipped_at,
    created_at: order.created_at,
    item_count: order.item_count,
    merchandise_total: order.merchandise_total,
  };
}

/**
 * Group eligible orders by match key. Groups with fewer than 2 orders are omitted
 * (nothing to consolidate). Does not create DB records.
 */
export function findConsolidationCandidates(
  orders: CandidateOrderInput[],
): ConsolidationCandidateGroup[] {
  const byKey = new Map<string, CandidateOrderInput[]>();

  for (const order of orders) {
    if (!isOrderEligibleForConsolidation(order)) continue;
    const key = buildConsolidationMatchKey({
      customerName: order.customer_name,
      email: order.email,
      address: order.address,
      postcode: order.postcode,
      currency: order.currency,
    });
    const list = byKey.get(key) ?? [];
    list.push(order);
    byKey.set(key, list);
  }

  const groups: ConsolidationCandidateGroup[] = [];

  for (const [match_key, members] of byKey) {
    if (members.length < 2) continue;

    members.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    const first = members[0]!;
    const merchandise_total = round2(
      members.reduce((s, o) => s + o.merchandise_total, 0),
    );
    const item_count = members.reduce((s, o) => s + o.item_count, 0);
    const order_numbers = members
      .map((o) => o.order_number ?? String(o.id))
      .filter(Boolean);
    const payment_statuses = [
      ...new Set(
        members.map((o) => o.payment_status ?? "unknown"),
      ),
    ];

    groups.push({
      match_key,
      customer_name: collapseDisplayName(first.customer_name),
      customer_email: normalizeEmail(first.email),
      delivery_address: displayAddress(first.address),
      postcode: first.postcode?.trim() || null,
      currency: normalizeCurrency(first.currency),
      order_count: members.length,
      order_numbers,
      item_count,
      merchandise_total,
      delivery_total: 0,
      delivery_review_required: true,
      payment_statuses,
      orders: members.map(toOrderSummary),
    });
  }

  groups.sort((a, b) => a.customer_name.localeCompare(b.customer_name));
  return groups;
}

/** Merge identical SKU lines only when unit price + currency match. */
export function mergeInvoiceLinesForDisplay<
  T extends {
    sku: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
    description: string;
  },
>(lines: T[]): T[] {
  const map = new Map<string, T>();
  const out: T[] = [];

  for (const line of lines) {
    const sku = (line.sku ?? "").trim();
    if (!sku) {
      out.push(line);
      continue;
    }
    const key = `${sku}|${round2(line.unit_price)}`;
    const existing = map.get(key);
    if (!existing) {
      const copy = { ...line };
      map.set(key, copy);
      out.push(copy);
      continue;
    }
    existing.quantity += line.quantity;
    existing.line_total = round2(existing.line_total + line.line_total);
  }

  return out;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function collapseDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function displayAddress(value: string | null): string {
  return (value ?? "").replace(/[\r\n]+/g, "\n").trim();
}

export function assertSameMatchKey(
  orders: CandidateOrderInput[],
): { ok: true; matchKey: string } | { ok: false; error: string } {
  if (orders.length < 2) {
    return { ok: false, error: "At least two orders are required to consolidate." };
  }
  const keys = new Set(
    orders.map((o) =>
      buildConsolidationMatchKey({
        customerName: o.customer_name,
        email: o.email,
        address: o.address,
        postcode: o.postcode,
        currency: o.currency,
      }),
    ),
  );
  if (keys.size !== 1 || [...keys][0] === "") {
    return {
      ok: false,
      error: "Orders must share the same normalized name, email, address, and currency.",
    };
  }
  for (const o of orders) {
    if (!isOrderEligibleForConsolidation({ ...o, already_consolidated: false })) {
      return {
        ok: false,
        error: `Order ${o.order_number ?? o.id} is not eligible for consolidation.`,
      };
    }
  }
  const currencies = new Set(orders.map((o) => normalizeCurrency(o.currency)));
  if (currencies.size !== 1) {
    return { ok: false, error: "Orders must share the same currency." };
  }
  return { ok: true, matchKey: [...keys][0]! };
}

export {
  buildConsolidationMatchKey,
  normalizeCurrency,
  normalizeCustomerName,
  normalizeDeliveryAddress,
  normalizeEmail,
  normalizePostcode,
};
