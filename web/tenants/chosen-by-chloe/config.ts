import type { TenantConfig } from "@/lib/thomas/tenant/types";

/** Chosen by Chloe — first tenant on Thomas OS. */
export const chosenByChloeTenant: TenantConfig = {
  slug: "chosen-by-chloe",
  organizationId: "00000000-0000-0000-0000-000000000001",
  name: "Chosen by Chloe",
  brand: {
    name: "Chosen by Chloe",
    tagline: "Curated with Care · Exclusive Value · Proven by Choice",
    logoUrl:
      "https://chosenbychloe.com/cdn/shop/files/TopLogo.jpg?v=1764941405&width=160",
    colors: {
      cream: "#faf6f2",
      espresso: "#3d2f2a",
      muted: "#6b5b55",
      clay: "#b08b7d",
      sand: "#f0e8e4",
      cocoa: "#2e3a47",
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
    subjectSuffix: "Chosen by Chloe",
    defaultCc: "dongchen@chosenbychloe.com",
  },
  integrations: {
    shopifyPortalTagPrefix: "portal",
  },
  storefront: {
    title: "Chosen by Chloe",
    description: "Order your favourites from Chosen by Chloe.",
    bannerText:
      "Chosen by Chloe is now open — carefully chosen by us, beautifully lived by you.",
  },
};
