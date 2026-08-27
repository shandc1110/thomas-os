export type { BrandConfig } from "./types";
export {
  BRAND_REGISTRY,
  getActiveBrands,
  getAllBrandSlugs,
  getBrandBySlug,
} from "./registry";
export {
  brandSlugFromProductBrand,
  normaliseBrandLabel,
  productBelongsToBrand,
  resolveBrandForProductBrand,
} from "./match";

/** Server-only catalog helpers — import from `@/lib/brands/catalog` in server code. */
