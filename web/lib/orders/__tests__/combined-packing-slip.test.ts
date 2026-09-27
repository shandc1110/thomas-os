import { describe, expect, it } from "vitest";
import {
  buildCombinedPackingSlipData,
  groupOrdersByShippingAddress,
  isOrderOpenForPacking,
} from "@/lib/orders/combined-packing-slip";
import type { OrderItemRecord, OrderWithItems } from "@/types/order";

function item(overrides: Partial<OrderItemRecord> = {}): OrderItemRecord {
  return {
    id: "i1",
    order_id: "o1",
    product_id: "p1",
    quantity: 1,
    price: 100,
    product_name: "Puzzle",
    product_sku: "MD1001",
    product_weight_grams: 500,
    product_image_url: null,
    product_gallery_images: [],
    presell_quantity: 0,
    ...overrides,
  };
}

function order(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  const items = overrides.items ?? [item()];
  return {
    id: "o1",
    order_number: "CBC1",
    customer_name: "Jane Smith",
    first_name: "Jane",
    last_name: "Smith",
    wechat_name: "jane_wx",
    phone: "0123",
    email: null,
    address: "10 Example Street, London",
    postcode: "SW1A 1AA",
    payment_method: "Bank transfer",
    payment_status: "paid",
    paid_at: null,
    currency: "CNY",
    notes: null,
    total_weight_grams: null,
    shopify_draft_order_id: null,
    fulfilment_status: "pending",
    warehouse_status: "pending",
    tracking_number: null,
    shipped_at: null,
    picked_at: null,
    packed_at: null,
    created_at: "2026-09-01T00:00:00Z",
    shopify_admin_url: null,
    ...overrides,
    items,
    total: overrides.total ?? items.reduce((s, i) => s + i.price * i.quantity, 0),
  };
}

describe("groupOrdersByShippingAddress", () => {
  it("groups by postcode + name even when address text and currency differ", () => {
    const groups = groupOrdersByShippingAddress([
      order({ id: "a", order_number: "CBC2", created_at: "2026-09-02T00:00:00Z" }),
      order({
        id: "b",
        order_number: "CBC1",
        customer_name: "JANE SMITH",
        address: "10 Example St\nLondon",
        postcode: "sw1a1aa",
        currency: "GBP",
      }),
      order({ id: "c", order_number: "CBC3", customer_name: "Bob", address: "5 Other Road" }),
    ]);
    expect(groups).toHaveLength(2);
    const jane = groups.find((g) => g.length === 2)!;
    expect(jane.map((o) => o.order_number)).toEqual(["CBC1", "CBC2"]);
  });

  it("also combines same address + postcode when the name is written differently", () => {
    const groups = groupOrdersByShippingAddress([
      order({ id: "a", customer_name: "Xiaoxiao Ma" }),
      order({ id: "b", customer_name: "Ma Xiaoxiao" }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("falls back to address without postcode; never combines when both missing", () => {
    const groups = groupOrdersByShippingAddress([
      order({ id: "a", postcode: null }),
      order({ id: "b", postcode: null, address: "10 example street london" }),
      order({ id: "c", postcode: null, address: null }),
      order({ id: "d", postcode: null, address: null }),
    ]);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 1, 2]);
  });
});

describe("buildCombinedPackingSlipData", () => {
  it("references all order numbers and merges identical lines", () => {
    const slip = buildCombinedPackingSlipData([
      order({ id: "a", order_number: "CBC1", notes: "Gift wrap" }),
      order({
        id: "b",
        order_number: "CBC2",
        phone: "0999",
        items: [item({ quantity: 2 }), item({ product_sku: "MD2002", price: 50 })],
      }),
    ]);
    expect(slip.orderNumbers).toEqual(["CBC1", "CBC2"]);
    expect(slip.orderNumber).toBe("CBC1 + CBC2");
    expect(slip.items).toHaveLength(2);
    expect(slip.items[0]).toMatchObject({ sku: "MD1001", quantity: 3, lineTotal: 300 });
    expect(slip.items[0]!.orderRefs).toBe("CBC1 ×1 · CBC2 ×2");
    expect(slip.items[1]!.orderRefs).toBe("CBC2 ×1");
    expect(slip.subtotal).toBe(350);
    expect(slip.totalWeightGrams).toBe(2000);
    expect(slip.phone).toBe("0123 / 0999");
    expect(slip.notes).toBe("CBC1: Gift wrap");
  });

  it("keeps currencies apart and totals per currency when mixed", () => {
    const slip = buildCombinedPackingSlipData([
      order({ id: "a", order_number: "CBC1" }),
      order({ id: "b", order_number: "CBC2", currency: "GBP", items: [item({ price: 12 })] }),
    ]);
    expect(slip.items).toHaveLength(2);
    expect(slip.items.map((i) => i.currency)).toEqual(["CNY", "GBP"]);
    expect(slip.totalsByCurrency).toEqual([
      { currency: "CNY", total: 100 },
      { currency: "GBP", total: 12 },
    ]);
    expect(slip.currency).toBe("CNY / GBP");
  });

  it("single order slip has no per-line order refs", () => {
    const slip = buildCombinedPackingSlipData([order()]);
    expect(slip.orderNumbers).toEqual(["CBC1"]);
    expect(slip.items[0]!.orderRefs).toBeUndefined();
  });
});

describe("isOrderOpenForPacking", () => {
  it("excludes fulfilled, cancelled and shipped orders", () => {
    expect(isOrderOpenForPacking(order())).toBe(true);
    expect(isOrderOpenForPacking(order({ fulfilment_status: "fulfilled" }))).toBe(false);
    expect(isOrderOpenForPacking(order({ warehouse_status: "shipped" }))).toBe(false);
  });
});
