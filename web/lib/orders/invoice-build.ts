import {
  mergeInvoiceLinesForDisplay,
} from "@/lib/orders/consolidation-core";
import type {
  InvoiceDocumentData,
  InvoiceLineSnapshot,
  InvoicePaymentLabel,
} from "@/types/consolidation";

/** Pure invoice document assembly (no I/O) — safe for Vitest. */
export function buildInvoiceDocumentData(input: {
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
  orderNumbers: string[];
  lines: InvoiceLineSnapshot[];
  merchandiseTotal: number;
  deliveryTotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
  notes: string | null;
}): InvoiceDocumentData {
  const merged = mergeInvoiceLinesForDisplay(
    input.lines.map((l) => ({
      description: l.description,
      sku: l.sku,
      quantity: l.quantity,
      unit_price: l.unit_price,
      line_total: l.line_total,
    })),
  );

  return {
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.invoiceDate,
    currency: input.currency,
    paymentStatusLabel: input.paymentStatusLabel,
    paymentMethod: input.paymentMethod,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    phone: input.phone,
    deliveryAddress: input.deliveryAddress,
    postcode: input.postcode,
    orderReferences: input.orderNumbers,
    lines: merged.map((l) => ({
      description: l.description,
      sku: l.sku,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      lineTotal: l.line_total,
    })),
    merchandiseTotal: input.merchandiseTotal,
    deliveryTotal: input.deliveryTotal,
    discountTotal: input.discountTotal,
    vatTotal: input.vatTotal,
    grandTotal: input.grandTotal,
    notes: input.notes,
  };
}
