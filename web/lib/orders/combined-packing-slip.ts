/**
 * Group orders going to the same shipping address into one combined packing slip.
 * Pure (no server-only) so Vitest can import it.
 */
import {
  normalizeCurrency,
  normalizeDeliveryAddress,
  normalizePostcode,
} from "@/lib/orders/consolidation-normalize";
import { computeTotalWeightGrams } from "@/lib/weight";
import type { OrderWithItems, PackingSlipData } from "@/types/order";

type SlipItem = PackingSlipData["items"][number];

/** Orders still to be packed: not fulfilled, shipped, delivered or cancelled. */
export function isOrderOpenForPacking(order: OrderWithItems): boolean {
  if (order.fulfilment_status === "fulfilled" || order.fulfilment_status === "cancelled") {
    return false;
  }
  return !["shipped", "delivered", "cancelled"].includes(order.warehouse_status);
}

/**
 * Keys that mark two orders as the same parcel (letters/digits only, case-insensitive):
 * postcode + recipient name, since the address is often typed differently ("Blvd" vs
 * "Boulevard"); and full address + postcode, since the name may be written differently.
 * Orders with neither never combine. Currencies may mix; the slip totals per currency.
 */
export function shippingMatchKeys(order: OrderWithItems): string[] {
  const postcode = lettersAndDigits(normalizePostcode(order.postcode));
  const name = lettersAndDigits(order.customer_name.toLowerCase());
  const address = lettersAndDigits(normalizeDeliveryAddress(order.address));
  const keys: string[] = [];
  if (postcode && name) keys.push(`pc:${postcode}|${name}`);
  if (address) keys.push(`addr:${address}|${postcode}`);
  return keys;
}

/** Ignore spacing and punctuation differences ("10 X St., London" vs "10 x st london"). */
function lettersAndDigits(value: string): string {
  return value.replace(/[^\p{L}\p{N}]/gu, "");
}

export function groupOrdersByShippingAddress(orders: OrderWithItems[]): OrderWithItems[][] {
  const parent = orders.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const firstIndexByKey = new Map<string, number>();
  orders.forEach((order, i) => {
    for (const key of shippingMatchKeys(order)) {
      const j = firstIndexByKey.get(key);
      if (j === undefined) firstIndexByKey.set(key, i);
      else parent[find(i)] = find(j);
    }
  });

  const groups = new Map<number, OrderWithItems[]>();
  orders.forEach((order, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(order);
    groups.set(root, list);
  });
  const result = [...groups.values()].map((list) =>
    [...list].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))),
  );
  result.sort((a, b) => a[0]!.customer_name.localeCompare(b[0]!.customer_name));
  return result;
}

function orderNumberOf(order: OrderWithItems): string {
  return order.order_number ?? String(order.id);
}

function distinctJoined(values: (string | null | undefined)[]): string {
  const seen: string[] = [];
  for (const v of values) {
    const trimmed = (v ?? "").trim();
    if (trimmed && !seen.some((s) => s.toLowerCase() === trimmed.toLowerCase())) seen.push(trimmed);
  }
  return seen.join(" / ");
}

function imageUrlsOf(item: OrderWithItems["items"][number]): string[] {
  const urls: string[] = [];
  if (item.product_image_url) urls.push(item.product_image_url);
  for (const g of item.product_gallery_images ?? []) {
    if (g && !urls.includes(g)) urls.push(g);
    if (urls.length >= 3) break;
  }
  return urls;
}

/**
 * One slip for a group of orders; lines with the same SKU, unit price and currency
 * are merged. Ship-to uses the most recent order's address.
 */
export function buildCombinedPackingSlipData(orders: OrderWithItems[]): PackingSlipData {
  if (orders.length === 0) throw new Error("No orders to combine.");
  const first = orders[0]!;
  const latest = orders[orders.length - 1]!;
  const orderNumbers = orders.map(orderNumberOf);
  const combined = orders.length > 1;
  const currencyOf = (o: OrderWithItems) => normalizeCurrency(o.currency) || "CNY";
  const currencies = [...new Set(orders.map(currencyOf))];
  const mixedCurrency = currencies.length > 1;

  const lines = new Map<string, SlipItem & { refs: { order: string; qty: number }[] }>();
  for (const order of orders) {
    const currency = currencyOf(order);
    for (const item of order.items) {
      const key = `${(item.product_sku ?? item.product_name).trim()}|${item.price}|${currency}`;
      const existing = lines.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.lineTotal += item.price * item.quantity;
        existing.refs.push({ order: orderNumberOf(order), qty: item.quantity });
      } else {
        lines.set(key, {
          name: item.product_name,
          sku: item.product_sku,
          quantity: item.quantity,
          unitPrice: item.price,
          lineTotal: item.price * item.quantity,
          imageUrls: imageUrlsOf(item).slice(0, 3),
          currency: mixedCurrency ? currency : undefined,
          refs: [{ order: orderNumberOf(order), qty: item.quantity }],
        });
      }
    }
  }

  const items: SlipItem[] = [...lines.values()].map(({ refs, ...line }) => ({
    ...line,
    orderRefs: combined ? refs.map((r) => `${r.order} ×${r.qty}`).join(" · ") : undefined,
  }));

  const totalsByCurrency = currencies.map((currency) => ({
    currency,
    total: orders.filter((o) => currencyOf(o) === currency).reduce((sum, o) => sum + o.total, 0),
  }));
  const subtotal = mixedCurrency ? 0 : totalsByCurrency[0]!.total;
  const totalWeightGrams = orders.reduce(
    (sum, o) =>
      sum +
      (o.total_weight_grams ??
        computeTotalWeightGrams(
          o.items.map((i) => ({ weight_grams: i.product_weight_grams, quantity: i.quantity })),
        )),
    0,
  );

  const notes = combined
    ? orders
        .filter((o) => o.notes?.trim())
        .map((o) => `${orderNumberOf(o)}: ${o.notes!.trim()}`)
        .join("\n") || null
    : first.notes;

  return {
    orderNumber: orderNumbers.join(" + "),
    orderNumbers,
    firstName: first.first_name ?? first.customer_name.split(" ")[0] ?? "",
    lastName: first.last_name ?? first.customer_name.split(" ").slice(1).join(" ") ?? "",
    customerName: first.customer_name,
    address: latest.address ?? first.address ?? "",
    postcode: latest.postcode ?? first.postcode ?? "",
    phone: distinctJoined(orders.map((o) => o.phone)),
    wechatId: distinctJoined(orders.map((o) => o.wechat_name)),
    paymentMethod: distinctJoined(orders.map((o) => o.payment_method)),
    currency: mixedCurrency ? currencies.join(" / ") : currencies[0]!,
    notes,
    items,
    subtotal,
    grandTotal: subtotal,
    totalsByCurrency: mixedCurrency ? totalsByCurrency : undefined,
    totalWeightGrams,
    createdAt: first.created_at,
  };
}
