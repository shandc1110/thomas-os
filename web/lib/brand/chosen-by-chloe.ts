/**
 * CHOSEN by Chloe — Brand System V4 (LOCKED).
 * Storefront Shell V1: docs/chosen-by-chloe-storefront-spec.md
 * Use asset paths from this module. Never recreate the wordmark or CC in HTML/CSS.
 */

export const CBC_V4_ASSET_BASE = "/brand/chosen-by-chloe/v4" as const;

export const cbcV4Assets = {
  /** PRIMARY MASTER — header / main identity */
  logoPrimaryHorizontal: `${CBC_V4_ASSET_BASE}/logo-primary-horizontal.png`,
  logoPrimaryStacked: `${CBC_V4_ASSET_BASE}/logo-primary-stacked.png`,
  logoHorizontalAlternative: `${CBC_V4_ASSET_BASE}/logo-horizontal-alternative.png`,
  logoMonochromeBlack: `${CBC_V4_ASSET_BASE}/logo-monochrome-black.png`,
  logoMonochromeWhite: `${CBC_V4_ASSET_BASE}/logo-monochrome-white.png`,
  /** Secondary — small-scale only */
  ccSignature: `${CBC_V4_ASSET_BASE}/cc-signature.png`,
  ccMonogram: `${CBC_V4_ASSET_BASE}/cc-monogram.png`,
  avatarIvory: `${CBC_V4_ASSET_BASE}/avatar-ivory.png`,
  avatarSage: `${CBC_V4_ASSET_BASE}/avatar-sage.png`,
  avatarCharcoal: `${CBC_V4_ASSET_BASE}/avatar-charcoal.png`,
  favicon: `${CBC_V4_ASSET_BASE}/favicon-cc.png`,
} as const;

/** Approved V4 core palette only. */
export const cbcV4Colors = {
  warmIvory: "#F8F1E5",
  charcoal: "#242321",
  sage: "#A8B19F",
  white: "#FFFFFF",
} as const;

export const cbcV4Brand = {
  displayName: "CHOSEN by Chloe",
  /** Alt text for primary wordmark assets */
  logoAlt: "CHOSEN by Chloe",
  /** Alt text for CC signature / monogram / avatar */
  ccAlt: "Chosen by Chloe",
  /** Philosophy line — not the hero statement */
  tagline: "We don't stock everything. We choose what deserves a place.",
  /** Locked Sprint 02 hero / banner */
  heroLine1: "CHOSEN WITH A MOTHER'S HEART",
  heroLine2: "FOR LITTLE LIVES",
  heroSupport: "Things we've tried, loved and chosen — for our little ones, and yours.",
  editSupport: "Things we've tried, loved and chosen.",
  bannerText: "CHOSEN WITH A MOTHER'S HEART · FOR LITTLE LIVES",
  nav: [
    { href: "/#shop", label: "Shop" },
    { href: "/#chloe-edit", label: "The Edit" },
    { href: "/#our-brands", label: "Brands" },
    { href: "/#our-story", label: "Our Story" },
  ] as const,
  assets: cbcV4Assets,
  colors: cbcV4Colors,
} as const;

export type CbcV4Assets = typeof cbcV4Assets;
