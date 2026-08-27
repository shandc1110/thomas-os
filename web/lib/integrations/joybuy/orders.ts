import type { JoybuyAddress, JoybuyOrder, JoybuyOrderLine, JoybuyOrderStatus } from "./types";

/**
 * Order adapter types and safe parsers.
 * Do not invent Joybuy API schemas — only normalize fields we can verify.
 */

export type {
  JoybuyAddress,
  JoybuyOrder,
  JoybuyOrderLine,
  JoybuyOrderStatus,
} from "./types";

const KNOWN_STATUSES: JoybuyOrderStatus[] = [
  "unknown",
  "pending",
  "paid",
  "cancelled",
  "shipped",
  "completed",
];

export function normalizeJoybuyOrderStatus(value: unknown): JoybuyOrderStatus {
  if (typeof value !== "string") return "unknown";
  const key = value.trim().toLowerCase() as JoybuyOrderStatus;
  return KNOWN_STATUSES.includes(key) ? key : "unknown";
}

export function normalizeJoybuyAddress(
  input: Partial<JoybuyAddress> | null | undefined,
): JoybuyAddress | null {
  if (!input) return null;
  return {
    name: input.name ?? null,
    phone: input.phone ?? null,
    line1: input.line1 ?? null,
    line2: input.line2 ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    postcode: input.postcode ?? null,
    country: input.country ?? null,
  };
}

/**
 * Build a JoybuyOrder from already-verified fields (e.g. after official API parse).
 * Rejects empty external order ids.
 */
export function buildJoybuyOrder(input: {
  externalOrderId: string;
  externalOrderNumber?: string | null;
  status?: unknown;
  currency?: string | null;
  placedAt?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  shippingAddress?: Partial<JoybuyAddress> | null;
  lines?: JoybuyOrderLine[];
}): JoybuyOrder {
  const externalOrderId = input.externalOrderId?.trim();
  if (!externalOrderId) {
    throw new Error("Joybuy order requires externalOrderId.");
  }

  return {
    externalOrderId,
    externalOrderNumber: input.externalOrderNumber?.trim() || null,
    status: normalizeJoybuyOrderStatus(input.status),
    currency: input.currency?.trim() || null,
    placedAt: input.placedAt ?? null,
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    customerPhone: input.customerPhone ?? null,
    shippingAddress: normalizeJoybuyAddress(input.shippingAddress),
    lines: Array.isArray(input.lines) ? input.lines : [],
  };
}
