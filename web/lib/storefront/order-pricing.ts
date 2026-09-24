/**
 * Authoritative unit pricing for order settlement.
 * Browser snapshots are display-only — server always re-resolves from DB fields.
 *
 * community → products.price (+ FX when order currency differs)
 * shopify   → products.shopify_price GBP (never FX from community CNY)
 */
import {
  normaliseCurrency,
  unitPriceForOrder,
  type OrderCurrency,
} from "@/lib/currency";
import {
  isChannelPriceConfigured,
  resolveChannelCommercial,
  type CommercialChannel,
} from "@/lib/storefront/commercial";
import type { Product } from "@/lib/types";

export type OrderPricingChannel = "community" | "shopify";

export type ProductPriceFields = Pick<
  Product,
  "price" | "currency" | "shopify_price" | "joybuy_price"
>;

export type ResolvedOrderUnitPrice = {
  unitPrice: number;
  currency: OrderCurrency;
  pricingChannel: OrderPricingChannel;
};

export type ResolveOrderUnitPriceError = {
  error: string;
  pricingChannel: OrderPricingChannel;
};

export function normaliseOrderPricingChannel(
  value: string | null | undefined,
): OrderPricingChannel {
  return value?.trim().toLowerCase() === "shopify" ? "shopify" : "community";
}

/**
 * Server-trusted unit price for a line.
 * Never accepts client-sent money amounts.
 */
export function resolveAuthoritativeUnitPrice(
  product: ProductPriceFields,
  pricingChannel: OrderPricingChannel,
  orderCurrency: OrderCurrency,
): ResolvedOrderUnitPrice | ResolveOrderUnitPriceError {
  if (pricingChannel === "shopify") {
    const commercial = resolveChannelCommercial(
      product as Product,
      "shopify" satisfies CommercialChannel,
    );
    if (!isChannelPriceConfigured(commercial) || commercial.channelPrice == null) {
      return {
        error:
          "A UK Shopify price is not configured for one or more items. Purchase cannot continue.",
        pricingChannel,
      };
    }
    if (orderCurrency !== "GBP") {
      return {
        error: "UK Shopify orders must be placed in GBP.",
        pricingChannel,
      };
    }
    return {
      unitPrice: commercial.channelPrice,
      currency: "GBP",
      pricingChannel: "shopify",
    };
  }

  // Community / Order Portal — existing FX behaviour when currencies differ.
  const unitPrice = unitPriceForOrder(
    product.price ?? 0,
    product.currency,
    orderCurrency,
  );
  return {
    unitPrice,
    currency: normaliseCurrency(orderCurrency),
    pricingChannel: "community",
  };
}

/** Client display helper — mirrors server shopify rule without FX. */
export function displayUnitPriceForCartLine(
  product: ProductPriceFields,
  pricingChannel: OrderPricingChannel | undefined,
  fallbackOrderCurrency: OrderCurrency = "CNY",
): { unitPrice: number; currency: OrderCurrency } {
  const channel = pricingChannel ?? "community";
  if (channel === "shopify") {
    const commercial = resolveChannelCommercial(product as Product, "shopify");
    if (isChannelPriceConfigured(commercial) && commercial.channelPrice != null) {
      return { unitPrice: commercial.channelPrice, currency: "GBP" };
    }
    return { unitPrice: 0, currency: "GBP" };
  }
  return {
    unitPrice: unitPriceForOrder(
      product.price ?? 0,
      product.currency,
      fallbackOrderCurrency,
    ),
    currency: normaliseCurrency(fallbackOrderCurrency),
  };
}
