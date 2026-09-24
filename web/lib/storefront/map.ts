import {
  formatExpectedArrival,
  getSellableStock,
  isPresellOnly,
} from "@/lib/presell";
import { buildProductSlug, productUrl } from "@/lib/products/slug";
import {
  resolveStorefrontImageUrl,
  resolveStorefrontImageUrls,
} from "@/lib/products/storefront-image";
import type { Product } from "@/lib/types";
import {
  resolveChannelCommercial,
  type CommercialChannel,
} from "./commercial";
import { isStorefrontEligible } from "./eligibility";
import { assessStorefrontReadiness } from "./readiness";
import type {
  StorefrontAvailabilityStatus,
  StorefrontProduct,
} from "./types";

export type ToStorefrontProductOptions = {
  /** Default website / Chloe Edit channel is shopify (GBP). */
  channel?: CommercialChannel;
};

function availabilityFor(product: Product): {
  status: StorefrontAvailabilityStatus;
  message: string | null;
  sellableStock: number;
} {
  const sellableStock = getSellableStock(product);
  const arrival = formatExpectedArrival(product.expected_arrival_month);

  if (sellableStock <= 0) {
    return { status: "sold_out", message: "Sold out", sellableStock: 0 };
  }

  if (isPresellOnly(product)) {
    return {
      status: "preorder",
      message: arrival ? `Pre-order · ships ${arrival}` : "Pre-order",
      sellableStock,
    };
  }

  return { status: "in_stock", message: null, sellableStock };
}

function badgesFor(
  product: Product,
  availability: StorefrontAvailabilityStatus,
): string[] {
  const badges: string[] = [];
  if (availability === "sold_out") badges.push("Sold out");
  if (availability === "preorder") {
    const arrival = formatExpectedArrival(product.expected_arrival_month);
    badges.push(arrival ? `Pre-order · ${arrival}` : "Pre-order");
  }
  return badges;
}

/**
 * Project operational Product → canonical StorefrontProduct.
 * Default channel is shopify (UK website). Never FX-converts community CNY.
 */
export function toStorefrontProduct(
  product: Product,
  options: ToStorefrontProductOptions = {},
): StorefrontProduct {
  const channel: CommercialChannel = options.channel ?? "shopify";
  const commercial = resolveChannelCommercial(product, channel);
  const shopifyCommercial = resolveChannelCommercial(product, "shopify");
  const joybuyCommercial = resolveChannelCommercial(product, "joybuy");

  const websiteEligible = isStorefrontEligible(product);
  const { status: availabilityStatus, message: availabilityMessage, sellableStock } =
    availabilityFor(product);

  const description = product.description?.trim() || null;
  const slug = buildProductSlug(product);
  const base: Omit<StorefrontProduct, "readiness"> = {
    productId: String(product.id),
    sku: product.sku,
    productName: product.name,
    brand: product.brand,
    productModel: product.sku,
    category: product.category,
    collection: null,
    tags: Array.isArray(product.tags) ? product.tags : [],
    badges: badgesFor(product, availabilityStatus),
    assortmentStatus: product.assortment_status,
    customerTitle: product.name,
    shortDescription: description,
    description,
    primaryImage: resolveStorefrontImageUrl(product.image_url),
    galleryImages: resolveStorefrontImageUrls(product.gallery_images ?? []),
    lifestyleImages: [],
    detailImages: [],
    channel,
    sourcePrice: commercial.sourcePrice,
    sourceCurrency: commercial.sourceCurrency,
    price: commercial.channelPrice,
    salePrice: null,
    currency: commercial.channelCurrency,
    priceStatus: commercial.priceStatus,
    sellableStock,
    availabilityStatus,
    availabilityMessage,
    websiteEligible,
    // Shared assortment gate only — Joybuy publish still uses channel mappers/IDs.
    joybuyEligible: websiteEligible,
    slug,
    url: productUrl(product),
  };

  return {
    ...base,
    readiness: assessStorefrontReadiness(base, {
      shopifyPriceStatus: shopifyCommercial.priceStatus,
      joybuyPriceStatus: joybuyCommercial.priceStatus,
    }),
  };
}

