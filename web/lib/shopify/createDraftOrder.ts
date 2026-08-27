import type { OrderWithItems } from "@/types/order";
import type { ShopifyPushResult } from "@/types/shopify";
import { convertCnyToGbp, normaliseCurrency } from "@/lib/currency";
import { computeTotalWeightGrams, gramsToKg } from "@/lib/weight";
import { getShopifyDraftOrderAdminUrl, portalOrderTag } from "./config";
import { shopifyGraphQL } from "./graphql";
import { searchDraftOrderByPortalNumber } from "./searchOrder";

const CREATE_DRAFT_ORDER = `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        totalWeight
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type DraftOrderLineItem = {
  title: string;
  quantity: number;
  originalUnitPrice: string;
  requiresShipping: boolean;
  sku?: string;
  weight?: { value: number; unit: "GRAMS" | "KILOGRAMS" };
};

function splitCustomerName(order: OrderWithItems): { firstName: string; lastName: string } {
  if (order.first_name) {
    return {
      firstName: order.first_name,
      lastName: order.last_name ?? "",
    };
  }
  const parts = order.customer_name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: order.customer_name.trim(), lastName: "" };
  }
  return {
    firstName: parts[0] ?? order.customer_name,
    lastName: parts.slice(1).join(" "),
  };
}

/** Normalise UK phones to E.164 (+44…) for Shopify validation. */
function toShopifyPhone(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  let phone = raw.trim().replace(/[\s\-().]/g, "");

  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (phone.startsWith("+44")) return phone;
  if (phone.startsWith("44") && phone.length >= 11) return `+${phone}`;
  if (phone.startsWith("0")) return `+44${phone.slice(1)}`;
  // Bare national number (e.g. 7xxx… mobile)
  if (/^\d{10,11}$/.test(phone)) return `+44${phone}`;
  if (phone.startsWith("+")) return phone;
  return `+44${phone}`;
}

function buildDraftOrderNote(order: OrderWithItems): string {
  const orderNumber = order.order_number ?? String(order.id);
  const orderCurrency = normaliseCurrency(order.currency);
  const lines = [
    `Portal Order: ${orderNumber}`,
    `WeChat ID: ${order.wechat_name}`,
    `Payment: ${order.payment_method ?? "N/A"}`,
    `Portal currency: ${orderCurrency}`,
  ];
  if (orderCurrency === "CNY") {
    lines.push("Shopify draft priced in GBP (converted from CNY).");
  }
  if (order.notes) {
    lines.push(`Customer notes: ${order.notes}`);
  }
  return lines.join("\n");
}

/** Shopify store is GBP — convert CNY line prices when needed. */
function unitPriceForShopify(order: OrderWithItems, unitPrice: number): string {
  const orderCurrency = normaliseCurrency(order.currency);
  const gbp = orderCurrency === "GBP" ? unitPrice : convertCnyToGbp(unitPrice);
  return gbp.toFixed(2);
}

function buildLineItems(order: OrderWithItems): DraftOrderLineItem[] {
  return order.items.map((item) => {
    const lineItem: DraftOrderLineItem = {
      title: item.product_name,
      quantity: item.quantity,
      originalUnitPrice: unitPriceForShopify(order, item.price),
      requiresShipping: true,
    };

    if (item.product_sku) {
      lineItem.sku = item.product_sku;
    }

    if (item.product_weight_grams && item.product_weight_grams > 0) {
      lineItem.weight = {
        value: item.product_weight_grams,
        unit: "GRAMS",
      };
    }

    return lineItem;
  });
}

/**
 * Push a portal order to Shopify as a Draft Order.
 * Returns early if the order is already synced (no duplicate created).
 */
export async function pushOrderToShopify(order: OrderWithItems): Promise<ShopifyPushResult> {
  const orderNumber = order.order_number ?? String(order.id);

  if (order.shopify_draft_order_id) {
    const adminUrl = getShopifyDraftOrderAdminUrl(order.shopify_draft_order_id);
    console.info(`[shopify] Order ${orderNumber} already synced locally as ${order.shopify_draft_order_id}`);
    return {
      success: true,
      alreadySynced: true,
      draftOrderId: order.shopify_draft_order_id,
      adminUrl: adminUrl ?? "",
    };
  }

  const existing = await searchDraftOrderByPortalNumber(orderNumber);
  if (existing) {
    const adminUrl = getShopifyDraftOrderAdminUrl(existing.id) ?? "";
    console.info(`[shopify] Order ${orderNumber} already exists in Shopify as ${existing.id}`);
    return {
      success: true,
      alreadySynced: true,
      draftOrderId: existing.id,
      adminUrl,
    };
  }

  const { firstName, lastName } = splitCustomerName(order);
  const totalWeightGrams =
    order.total_weight_grams ??
    computeTotalWeightGrams(
      order.items.map((item) => ({
        weight_grams: item.product_weight_grams,
        quantity: item.quantity,
      })),
    );

  const tag = portalOrderTag(orderNumber);

  const phone = toShopifyPhone(order.phone);

  // Store currency is GBP — CNY is not enabled on Shopify Markets for this shop.
  const input = {
    email: order.email ?? undefined,
    phone,
    note: buildDraftOrderNote(order),
    tags: [tag, "portal-order", "chosen-by-chloe"],
    presentmentCurrencyCode: "GBP",
    shippingAddress: {
      firstName,
      lastName,
      address1: order.address ?? "",
      zip: order.postcode ?? "",
      phone,
      countryCode: "GB",
    },
    lineItems: buildLineItems(order),
    customAttributes: [
      { key: "portal_order_number", value: orderNumber },
      { key: "wechat_id", value: order.wechat_name },
      { key: "portal_currency", value: normaliseCurrency(order.currency) },
      ...(totalWeightGrams > 0
        ? [{ key: "parcel_weight_kg", value: String(gramsToKg(totalWeightGrams)) }]
        : []),
    ],
  };

  console.info(`[shopify] Creating draft order for ${orderNumber} with ${order.items.length} line items`);

  const data = await shopifyGraphQL<{
    draftOrderCreate: {
      draftOrder: { id: string; name: string; totalWeight: number | null } | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  }>(CREATE_DRAFT_ORDER, { input });

  const { draftOrder, userErrors } = data.draftOrderCreate;

  if (userErrors.length > 0) {
    const message = userErrors.map((e) => e.message).join("; ");
    console.error(`[shopify] Draft order creation failed for ${orderNumber}:`, message);
    return { success: false, error: message };
  }

  if (!draftOrder) {
    return { success: false, error: "Shopify did not return a draft order." };
  }

  const adminUrl = getShopifyDraftOrderAdminUrl(draftOrder.id) ?? "";
  console.info(`[shopify] Created draft order ${draftOrder.id} (${draftOrder.name}) for ${orderNumber}`);

  return {
    success: true,
    alreadySynced: false,
    draftOrderId: draftOrder.id,
    adminUrl,
  };
}
