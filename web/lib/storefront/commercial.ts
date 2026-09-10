/**
 * Channel commercial pricing — Community / Shopify / Joybuy.
 *
 * No FX conversion. No inferred retail. No overwrite of source price.
 *
 * Community → products.price + products.currency
 * Shopify   → products.shopify_price as GBP (or native GBP source when shopify unset)
 * Joybuy    → products.joybuy_price as GBP only
 */

import type { Product } from "@/lib/types";

export type CommercialChannel = "community" | "shopify" | "joybuy";

export type ChannelPriceStatus = "configured" | "missing";

export type ChannelCommercial = {
  channel: CommercialChannel;
  /** Community / source price — always from products.price */
  sourcePrice: number | null;
  sourceCurrency: string;
  /** Selected channel selling price — null when missing */
  channelPrice: number | null;
  channelCurrency: string | null;
  priceStatus: ChannelPriceStatus;
};

function positiveAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function sourceCurrencyOf(product: Product): string {
  const c = product.currency?.trim().toUpperCase();
  return c || "CNY";
}

/**
 * Resolve commercial presentation for a channel.
 * Never converts CNY→GBP. Never invents prices.
 */
export function resolveChannelCommercial(
  product: Product,
  channel: CommercialChannel,
): ChannelCommercial {
  const sourcePrice = positiveAmount(product.price);
  const sourceCurrency = sourceCurrencyOf(product);

  if (channel === "community") {
    return {
      channel,
      sourcePrice,
      sourceCurrency,
      channelPrice: sourcePrice,
      channelCurrency: sourcePrice != null ? sourceCurrency : null,
      priceStatus: sourcePrice != null ? "configured" : "missing",
    };
  }

  if (channel === "shopify") {
    const shopify = positiveAmount(product.shopify_price);
    if (shopify != null) {
      return {
        channel,
        sourcePrice,
        sourceCurrency,
        channelPrice: shopify,
        channelCurrency: "GBP",
        priceStatus: "configured",
      };
    }

    // Native UK catalogue already in GBP (e.g. Micro Scooters) — not FX.
    // CNY source with null shopify_price → missing (never show ¥ on UK storefront).
    if (sourceCurrency === "GBP" && sourcePrice != null) {
      return {
        channel,
        sourcePrice,
        sourceCurrency,
        channelPrice: sourcePrice,
        channelCurrency: "GBP",
        priceStatus: "configured",
      };
    }

    return {
      channel,
      sourcePrice,
      sourceCurrency,
      channelPrice: null,
      channelCurrency: "GBP",
      priceStatus: "missing",
    };
  }

  // joybuy — explicit GBP only; no fallback to products.price or shopify_price
  const joybuy = positiveAmount(product.joybuy_price);
  if (joybuy != null) {
    return {
      channel,
      sourcePrice,
      sourceCurrency,
      channelPrice: joybuy,
      channelCurrency: "GBP",
      priceStatus: "configured",
    };
  }

  return {
    channel,
    sourcePrice,
    sourceCurrency,
    channelPrice: null,
    channelCurrency: "GBP",
    priceStatus: "missing",
  };
}

export function isChannelPriceConfigured(commercial: ChannelCommercial): boolean {
  return commercial.priceStatus === "configured" && commercial.channelPrice != null;
}
