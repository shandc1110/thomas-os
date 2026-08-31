export type BrandConfig = {
  /** URL slug, e.g. "mideer" → /brands/mideer */
  slug: string;
  /** Display name */
  name: string;
  /**
   * Product.brand strings that belong to this brand (matched case-insensitively).
   * Keep in sync with import scripts / admin data.
   */
  matchNames: string[];
  tagline: string;
  description: string;
  logoUrl?: string;
  /** Wider logo container on brand page hero (Tailwind classes). */
  logoWidthClass?: string;
  /** Logo img sizing on brand page hero (Tailwind classes). */
  logoImageClass?: string;
  /** Logo sizing on homepage / hub brand cards (Tailwind classes). */
  logoCardClass?: string;
  /** Soft accent for hero (CSS color). */
  heroAccent: string;
  metaTitle: string;
  metaDescription: string;
  /** When false, hidden from nav/hub until enabled. */
  active: boolean;
  defaultCurrency: "CNY" | "GBP";
};
