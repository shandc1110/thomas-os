export type {
  StorefrontAvailabilityStatus,
  StorefrontProduct,
  StorefrontReadiness,
  StorefrontReadinessIssue,
  StorefrontReadinessStatus,
  StorefrontCommercialReadiness,
} from "./types";

export type {
  ChannelCommercial,
  ChannelPriceStatus,
  CommercialChannel,
} from "./commercial";

export {
  isChannelPriceConfigured,
  resolveChannelCommercial,
} from "./commercial";

export {
  displayUnitPriceForCartLine,
  normaliseOrderPricingChannel,
  resolveAuthoritativeUnitPrice,
} from "./order-pricing";
export type {
  OrderPricingChannel,
  ProductPriceFields,
  ResolvedOrderUnitPrice,
} from "./order-pricing";

export {
  isStorefrontAssortmentActive,
  isStorefrontEligible,
} from "./eligibility";

export { toStorefrontProduct } from "./map";
export type { ToStorefrontProductOptions } from "./map";
export { assessStorefrontReadiness } from "./readiness";
export {
  listStorefrontReadiness,
  primaryStorefrontLabel,
  productToReadinessRow,
} from "./readiness-admin";
export type {
  AssortmentReviewFilter,
  ListStorefrontReadinessOptions,
  ListStorefrontReadinessResult,
  ReadinessFilter,
  StorefrontReadinessCounts,
  StorefrontReadinessRow,
} from "./readiness-admin";

export {
  fetchActiveStorefrontProducts,
  listActiveCatalogueEnrichment,
  normalizeEnrichmentText,
  proposeChloeEditCandidates,
  storefrontProductToEnrichmentRow,
  updateActiveProductEnrichment,
} from "./enrichment-admin";
export type {
  ActiveEnrichmentCounts,
  ActiveEnrichmentRow,
  EnrichmentFilter,
  EnrichmentUpdateResult,
  ListActiveEnrichmentOptions,
  ListActiveEnrichmentResult,
} from "./enrichment-admin";

export {
  getStorefrontProduct,
  getStorefrontProductBySlug,
  getStorefrontProducts,
  projectStorefrontProduct,
  searchStorefrontProducts,
} from "./service";

export { projectChloeEditFeedFromRows } from "./chloe-edit-project";
export type { ChloeEditFeedItem } from "./chloe-edit-project";
