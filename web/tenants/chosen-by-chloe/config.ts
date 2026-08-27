import type { TenantConfig } from "@/lib/thomas/tenant/types";
import { cbcV4Assets, cbcV4Brand, cbcV4Colors } from "@/lib/brand/chosen-by-chloe";

/** Chosen by Chloe — first tenant on Thomas OS (Brand System V4). */
export const chosenByChloeTenant: TenantConfig = {
  slug: "chosen-by-chloe",
  organizationId: "00000000-0000-0000-0000-000000000001",
  name: cbcV4Brand.displayName,
  brand: {
    name: cbcV4Brand.displayName,
    tagline: cbcV4Brand.tagline,
    /** PRIMARY MASTER — never replace with CC */
    logoUrl: cbcV4Assets.logoPrimaryHorizontal,
    colors: {
      cream: cbcV4Colors.warmIvory,
      espresso: cbcV4Colors.charcoal,
      muted: "#6b6a66",
      clay: cbcV4Colors.sage,
      sand: "#e8dfd2",
      cocoa: cbcV4Colors.charcoal,
    },
  },
  commerce: {
    orderNumberPrefix: "CBC",
    orderNumberStart: 9001,
    cartStorageKey: "thomas-cart-chosen-by-chloe-v1",
    cnyToGbpRate: 9.25,
    /** 10% FX markup: effective rate = 9.25 × 1.1 (customer pays more in GBP). */
    cnyToGbpMarkup: 1.1,
    defaultCurrency: "CNY",
  },
  email: {
    subjectSuffix: cbcV4Brand.displayName,
    defaultCc: "dongchen@chosenbychloe.com",
  },
  integrations: {
    shopifyPortalTagPrefix: "portal",
  },
  storefront: {
    title: cbcV4Brand.displayName,
    description:
      "Chosen with a mother's heart for little lives. Things we've tried, loved and chosen — for our little ones, and yours.",
    bannerText: cbcV4Brand.bannerText,
  },
};
