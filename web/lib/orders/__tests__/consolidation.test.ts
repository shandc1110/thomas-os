import { describe, expect, it } from "vitest";
import {
  assertSameMatchKey,
  findConsolidationCandidates,
  isOrderEligibleForConsolidation,
  isPaymentOperationallyValid,
  mergeInvoiceLinesForDisplay,
  type CandidateOrderInput,
} from "@/lib/orders/consolidation-core";
import {
  buildConsolidationMatchKey,
  normalizeCustomerName,
  normalizeDeliveryAddress,
  normalizeEmail,
} from "@/lib/orders/consolidation-normalize";
import { buildInvoiceDocumentData } from "@/lib/orders/invoice-build";

function baseOrder(overrides: Partial<CandidateOrderInput> = {}): CandidateOrderInput {
  return {
    id: "o1",
    order_number: "CBC10001",
    customer_name: "Jane Smith",
    email: "jane@example.com",
    address: "10 Example Street\nLondon",
    postcode: "SW1A 1AA",
    currency: "GBP",
    payment_method: "Bank transfer",
    payment_status: "paid",
    fulfilment_status: "pending",
    warehouse_status: "pending",
    shipped_at: null,
    created_at: "2026-09-01T10:00:00Z",
    item_count: 1,
    merchandise_total: 29.99,
    already_consolidated: false,
    ...overrides,
  };
}

describe("consolidation normalization", () => {
  it("normalizes name case and whitespace", () => {
    expect(normalizeCustomerName("  Jane   Smith ")).toBe("jane smith");
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });

  it("normalizes address line breaks to spaces for matching", () => {
    expect(normalizeDeliveryAddress("10 Example Street\nLondon")).toBe(
      "10 example street london",
    );
    expect(
      buildConsolidationMatchKey({
        customerName: "Jane Smith",
        email: "jane@example.com",
        address: "10 Example Street\nLondon",
        postcode: "SW1A 1AA",
        currency: "GBP",
      }),
    ).toBe(
      buildConsolidationMatchKey({
        customerName: "jane  smith",
        email: "JANE@EXAMPLE.COM",
        address: "10 Example Street London",
        postcode: "sw1a 1aa",
        currency: "gbp",
      }),
    );
  });

  it("does not treat High St as High Street", () => {
    const a = buildConsolidationMatchKey({
      customerName: "Jane Smith",
      email: "jane@example.com",
      address: "10 High Street",
      postcode: "SW1A 1AA",
      currency: "GBP",
    });
    const b = buildConsolidationMatchKey({
      customerName: "Jane Smith",
      email: "jane@example.com",
      address: "10 High St",
      postcode: "SW1A 1AA",
      currency: "GBP",
    });
    expect(a).not.toBe(b);
  });
});

describe("findConsolidationCandidates", () => {
  it("groups Jane Smith A+B+C into one candidate", () => {
    const orders = [
      baseOrder({ id: "a", order_number: "CBC-A", merchandise_total: 29.99 }),
      baseOrder({
        id: "b",
        order_number: "CBC-B",
        merchandise_total: 49.99,
        created_at: "2026-09-02T10:00:00Z",
      }),
      baseOrder({
        id: "c",
        order_number: "CBC-C",
        merchandise_total: 20,
        created_at: "2026-09-03T10:00:00Z",
      }),
    ];
    const groups = findConsolidationCandidates(orders);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.order_count).toBe(3);
    expect(groups[0]!.merchandise_total).toBe(99.98);
    expect(groups[0]!.delivery_total).toBe(0);
    expect(groups[0]!.delivery_review_required).toBe(true);
    expect(groups[0]!.currency).toBe("GBP");
  });

  it("separates different name / email / address", () => {
    expect(
      findConsolidationCandidates([
        baseOrder({ id: "1" }),
        baseOrder({ id: "2", customer_name: "John Smith" }),
      ]),
    ).toHaveLength(0);

    expect(
      findConsolidationCandidates([
        baseOrder({ id: "1" }),
        baseOrder({ id: "2", email: "other@example.com" }),
      ]),
    ).toHaveLength(0);

    expect(
      findConsolidationCandidates([
        baseOrder({ id: "1" }),
        baseOrder({ id: "2", address: "11 Example Street\nLondon" }),
      ]),
    ).toHaveLength(0);
  });

  it("separates different currencies", () => {
    expect(
      findConsolidationCandidates([
        baseOrder({ id: "1", currency: "GBP" }),
        baseOrder({ id: "2", currency: "CNY", merchandise_total: 100 }),
      ]),
    ).toHaveLength(0);
  });

  it("excludes cancelled, fulfilled, shipped, refunded", () => {
    const partner = baseOrder({ id: "ok", order_number: "OK" });
    expect(
      isOrderEligibleForConsolidation(
        baseOrder({ fulfilment_status: "cancelled" }),
      ),
    ).toBe(false);
    expect(
      isOrderEligibleForConsolidation(
        baseOrder({ fulfilment_status: "fulfilled" }),
      ),
    ).toBe(false);
    expect(
      isOrderEligibleForConsolidation(
        baseOrder({ warehouse_status: "shipped", shipped_at: "2026-09-01" }),
      ),
    ).toBe(false);
    expect(isPaymentOperationallyValid({ payment_status: "refunded", payment_method: "Bank transfer" })).toBe(
      false,
    );
    expect(
      findConsolidationCandidates([
        partner,
        baseOrder({ id: "bad", fulfilment_status: "cancelled" }),
      ]),
    ).toHaveLength(0);
  });

  it("assertSameMatchKey rejects mixed groups", () => {
    const result = assertSameMatchKey([
      baseOrder({ id: "1" }),
      baseOrder({ id: "2", email: "x@y.com" }),
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("invoice line merge + document data", () => {
  it("merges same sku + same unit price only", () => {
    const merged = mergeInvoiceLinesForDisplay([
      {
        sku: "CT7013",
        description: "Body Magnet",
        quantity: 1,
        unit_price: 29.99,
        line_total: 29.99,
      },
      {
        sku: "CT7013",
        description: "Body Magnet",
        quantity: 2,
        unit_price: 29.99,
        line_total: 59.98,
      },
      {
        sku: "CT7013",
        description: "Body Magnet",
        quantity: 1,
        unit_price: 32.99,
        line_total: 32.99,
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]!.quantity).toBe(3);
    expect(merged[0]!.line_total).toBe(89.97);
    expect(merged[1]!.unit_price).toBe(32.99);
  });

  it("builds Jane Smith invoice from historical lines", () => {
    const doc = buildInvoiceDocumentData({
      invoiceNumber: "CBC-INV-2609-001",
      invoiceDate: "2026-09-24",
      currency: "GBP",
      paymentStatusLabel: "PAID",
      paymentMethod: "Bank transfer",
      customerName: "Jane Smith",
      customerEmail: "jane@example.com",
      phone: null,
      deliveryAddress: "10 Example Street\nLondon",
      postcode: "SW1A 1AA",
      orderNumbers: ["CBC-A", "CBC-B", "CBC-C"],
      lines: [
        {
          order_id: "a",
          order_number: "CBC-A",
          order_item_id: "i1",
          product_id: "p1",
          description: "Item A",
          sku: "SKU-A",
          quantity: 1,
          unit_price: 29.99,
          line_total: 29.99,
        },
        {
          order_id: "b",
          order_number: "CBC-B",
          order_item_id: "i2",
          product_id: "p2",
          description: "Item B",
          sku: "SKU-B",
          quantity: 1,
          unit_price: 49.99,
          line_total: 49.99,
        },
        {
          order_id: "c",
          order_number: "CBC-C",
          order_item_id: "i3",
          product_id: "p3",
          description: "Item C",
          sku: "SKU-C",
          quantity: 1,
          unit_price: 20,
          line_total: 20,
        },
      ],
      merchandiseTotal: 99.98,
      deliveryTotal: 0,
      discountTotal: 0,
      vatTotal: 0,
      grandTotal: 99.98,
      notes: null,
    });

    expect(doc.orderReferences).toEqual(["CBC-A", "CBC-B", "CBC-C"]);
    expect(doc.merchandiseTotal).toBe(99.98);
    expect(doc.deliveryTotal).toBe(0);
    expect(doc.discountTotal).toBe(0);
    expect(doc.vatTotal).toBe(0);
    expect(doc.grandTotal).toBe(99.98);
    expect(doc.lines).toHaveLength(3);
    expect(doc.paymentStatusLabel).toBe("PAID");
  });
});
