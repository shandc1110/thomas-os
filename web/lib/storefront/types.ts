/**
 * Canonical Storefront Product model — projection from public.products.
 * Not a second source of truth. Channel commercial prices resolve per channel.
 */

import type { AssortmentStatus } from "@/lib/types";
import type { ChannelPriceStatus, CommercialChannel } from "./commercial";

/** Customer-facing availability derived from sellable stock + presell. */
export type StorefrontAvailabilityStatus =
  | "in_stock"
  | "preorder"
  | "sold_out"
  | "unavailable";

/**
 * Deterministic readiness issues — no invented copy.
 * READY when critical display fields for publication are present.
 * UK commercial readiness is separate (see commercialReadiness).
 */
export type StorefrontReadinessIssue =
  | "MISSING_IMAGE"
  | "MISSING_CATEGORY"
  | "MISSING_DESCRIPTION"
  | "MISSING_PRICE"
  | "MISSING_BRAND"
  | "MISSING_NAME"
  | "MISSING_SKU"
  | "NOT_ELIGIBLE";

export type StorefrontReadinessStatus = "READY" | "NOT_READY";

export type StorefrontCommercialReadiness = {
  status: StorefrontReadinessStatus;
  /** True when channelPrice is explicitly configured for this channel. */
  priceStatus: ChannelPriceStatus;
};

export type StorefrontReadiness = {
  /** Content / assortment readiness (community source price, not UK channel price). */
  status: StorefrontReadinessStatus;
  issues: StorefrontReadinessIssue[];
  /** Shopify / CBC UK commercial gate — separate from content READY. */
  shopify: StorefrontCommercialReadiness;
  /** Joybuy UK commercial gate — separate from content READY. */
  joybuy: StorefrontCommercialReadiness;
};

/**
 * Channel-agnostic storefront projection.
 * Default website projection uses channel = shopify.
 */
export type StorefrontProduct = {
  // identity
  productId: string;
  sku: string | null;
  productName: string;
  brand: string | null;
  /** Shared model key — currently SKU when present (Joybuy productModel pattern). */
  productModel: string | null;

  // merchandising (raw; curated taxonomy deferred)
  category: string | null;
  /** Reserved for future customer-facing collections — always null in V1. */
  collection: string | null;
  tags: string[];
  badges: string[];
  assortmentStatus: AssortmentStatus | null;

  // content (reuse existing fields only; never invent)
  customerTitle: string;
  shortDescription: string | null;
  description: string | null;

  // media
  primaryImage: string | null;
  galleryImages: string[];
  lifestyleImages: string[];
  detailImages: string[];

  /** Channel this projection was resolved for (website default: shopify). */
  channel: CommercialChannel;

  // commercial — source (community) always retained
  sourcePrice: number | null;
  sourceCurrency: string;

  /**
   * Customer-facing channel price for `channel`.
   * For website/shopify: shopify_price GBP (or native GBP source).
   * Null when priceStatus = missing — never silently falls back to CNY.
   */
  price: number | null;
  /** No sale_price column in SoT — always null in V1. */
  salePrice: number | null;
  currency: string | null;
  priceStatus: ChannelPriceStatus;

  // availability
  sellableStock: number;
  availabilityStatus: StorefrontAvailabilityStatus;
  availabilityMessage: string | null;

  // channel eligibility (shared assortment gate; Joybuy IDs/prices remain channel-specific)
  websiteEligible: boolean;
  joybuyEligible: boolean;

  // SEO / URL — slug derived, not a DB column
  slug: string;
  /** Canonical PDP path — existing /products/[slug]. */
  url: string;

  readiness: StorefrontReadiness;
};
