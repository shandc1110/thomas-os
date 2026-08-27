import type { BrandConfig } from "./types";

/**
 * Storefront brand registry — single source of truth for brand pages & nav.
 * Adding a brand: append a config, set `active: true`, associate products via `matchNames`.
 */
export const BRAND_REGISTRY: BrandConfig[] = [
  {
    slug: "mideer",
    name: "Mideer",
    matchNames: ["mideer", "mi deer"],
    tagline: "Thoughtful toys for curious minds",
    description:
      "Discover our curated Mideer collection — creative, educational toys chosen for quality and play value. Pre-order incoming stock or shop what's ready now.",
    /** Official wordmark from mideer.store */
    logoUrl: "/brands/mideer.svg",
    heroAccent: "#b08b7d",
    metaTitle: "Mideer | Chosen by Chloe",
    metaDescription:
      "Shop Mideer toys curated by Chosen by Chloe — creative arts, puzzles, and educational play for little ones.",
    active: true,
    defaultCurrency: "CNY",
  },
  {
    slug: "tonies",
    name: "Tonies",
    matchNames: ["tonies", "tonie"],
    tagline: "Stories, songs & screen-free listening",
    description:
      "Explore our Tonies range — Tonieboxes, characters, and accessories at UK RRP. Pick favourites for bedtime stories and imaginative play.",
    /** Official linear logo from tonies.com (Contentful) */
    logoUrl: "/brands/tonies.svg",
    heroAccent: "#2e3a47",
    metaTitle: "Tonies | Chosen by Chloe",
    metaDescription:
      "Explore our curated collection of Tonies products — Tonieboxes, characters, and accessories from Chosen by Chloe.",
    active: true,
    defaultCurrency: "GBP",
  },
  {
    slug: "micro-scooters",
    name: "Micro Scooters",
    matchNames: ["micro scooters", "micro scooter"],
    tagline: "Swiss-designed scooters for every age",
    description:
      "Shop our Micro Scooters dropship range — Mini & Maxi, nursery & travel, 5+ scooters, helmets and accessories at UK RRP.",
    logoUrl: "/brands/micro-scooters.png",
    heroAccent: "#e10600",
    metaTitle: "Micro Scooters | Chosen by Chloe",
    metaDescription:
      "Micro Scooters curated by Chosen by Chloe — Mini & Maxi, nursery, 5+ scooters, helmets and accessories.",
    active: true,
    defaultCurrency: "GBP",
  },
  {
    slug: "connetix",
    name: "Connetix",
    matchNames: ["connetix"],
    tagline: "Coming soon",
    description: "Connetix will appear here when stock is listed.",
    heroAccent: "#6b5b55",
    metaTitle: "Connetix | Chosen by Chloe",
    metaDescription: "Connetix magnetic tiles curated by Chosen by Chloe — coming soon.",
    active: false,
    defaultCurrency: "GBP",
  },
  {
    slug: "le-toy-van",
    name: "Le Toy Van",
    matchNames: ["le toy van"],
    tagline: "Coming soon",
    description: "Le Toy Van will appear here when stock is listed.",
    heroAccent: "#6b5b55",
    metaTitle: "Le Toy Van | Chosen by Chloe",
    metaDescription: "Le Toy Van wooden toys curated by Chosen by Chloe — coming soon.",
    active: false,
    defaultCurrency: "GBP",
  },
];

export function getActiveBrands(): BrandConfig[] {
  return BRAND_REGISTRY.filter((b) => b.active);
}

export function getBrandBySlug(slug: string): BrandConfig | null {
  const key = slug.trim().toLowerCase();
  return BRAND_REGISTRY.find((b) => b.slug === key) ?? null;
}

export function getAllBrandSlugs(): string[] {
  return BRAND_REGISTRY.map((b) => b.slug);
}
