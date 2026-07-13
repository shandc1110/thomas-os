import type { OrderWithItems } from "@/types/order";
import type { ShopifyPushResult } from "@/types/shopify";
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

function buildDraftOrderNote(order: OrderWithItems): string {
  const orderNumber = order.order_number ?? String(order.id);
  const lines = [
    `Portal Order: ${orderNumber}`,
    `WeChat ID: ${order.wechat_name}`,
    `Payment: ${order.payment_method ?? "N/A"}`,
    `Currency: ${order.currency ?? "CNY"}`,
  ];
  if (order.notes) {
    lines.push(`Customer notes: ${order.notes}`);
  }
  return lines.join("\n");
}

function buildLineItems(order: OrderWithItems): DraftOrderLineItem[] {
  return order.items.map((item) => {
    const lineItem: DraftOrderLineItem = {
      title: item.product_name,
      quantity: item.quantity,
      originalUnitPrice: item.price.toFixed(2),
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

  const currency = order.currency === "GBP" ? "GBP" : "CNY";
  const tag = portalOrderTag(orderNumber);

  const input = {
    email: order.email ?? undefined,
    phone: order.phone,
    note: buildDraftOrderNote(order),
    tags: [tag, "portal-order", "chosen-by-chloe"],
    presentmentCurrencyCode: currency,
    shippingAddress: {
      firstName,
      lastName,
      address1: order.address ?? "",
      zip: order.postcode ?? "",
      phone: order.phone,
    },
    lineItems: buildLineItems(order),
    ...(totalWeightGrams > 0
      ? {
          customAttributes: [
            { key: "portal_order_number", value: orderNumber },
            { key: "parcel_weight_kg", value: String(gramsToKg(totalWeightGrams)) },
            { key: "wechat_id", value: order.wechat_name },
          ],
        }
      : {
          customAttributes: [
            { key: "portal_order_number", value: orderNumber },
            { key: "wechat_id", value: order.wechat_name },
          ],
        }),
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
