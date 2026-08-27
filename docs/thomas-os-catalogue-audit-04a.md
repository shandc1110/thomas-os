# Thomas OS Catalogue Audit

## Sprint 04A

**Status:** AUDIT ONLY — no production code or data changed  
**Date:** 2026-08-27  
**Baseline:** Storefront Shell V1 locked (`chore: lock Chosen by Chloe storefront shell v1`)  
**Scope:** Read-only inspection of Thomas OS catalogue architecture for future Chosen by Chloe storefront integration

> **Do not populate ChloeEditGrid from this sprint.**  
> Merchandising selection is Sprint 04B+.  
> Adapter implementation is Sprint 04B+ (when requested).

---

### 1. Executive Summary

Thomas OS already has a **working product catalogue** stored in **Supabase Postgres** (`public.products`), exposed to the storefront via `fetchCatalogProducts()` and `GET /api/catalog`. The canonical application type is `Product` in `web/lib/types.ts`.

**Key findings:**

| Topic | Finding |
|-------|---------|
| Source of truth | Supabase `products` table (primary); free-text brand matched to code registry; inventory ledger denormalised onto `products.stock` |
| Identity | Prefer **`products.id` (UUID)** as stable storefront id; **`sku`** as business key (partial unique index) |
| Variants | **None** — flat one-row-per-SKU model |
| PDP / product URL | **No public product detail route**; ChloeEditGrid currently links to brand pages |
| Shell readiness | Almost all storefront fields map; largest gaps are **stable productUrl**, **merchandising selection**, and **adapter boundary** (shell must not query Supabase directly) |
| Live DQ % | Not measured against production DB in this audit (read-only; no live catalogue dump in repo). Sample evidence exists in scripts/audit JSON for MiDeer pricing only |

**Recommended direction (design only):**

```
Thomas OS Catalogue (Supabase products)
        ↓
Catalogue Adapter (map + visibility + sellable)
        ↓
NormalizedProduct[]
        ↓
Chosen by Chloe Storefront Shell V1
        ↓
ChloeEditGrid
```

---

### 2. Current Catalogue Architecture

```
Excel / PI / CSV / Shopify export JSON  (import scripts)
                ↓ upsert onConflict: sku
         public.products  (Supabase)
                │
                ├── active + organization_id  →  storefront catalog
                ├── brand (text)  →  BRAND_REGISTRY match  →  /brands/[slug]
                ├── stock ← sync from inventory_balances (ADR-002)
                ├── presell_* ← checkout decrement
                ├── image_url + gallery_images ← Storage / Drive scripts
                └── channel_product_mappings → Joybuy external IDs (foundation)
```

**Application entry points**

| Layer | Location |
|-------|----------|
| Storefront fetch | `web/lib/brands/catalog.ts` → `fetchCatalogProducts`, `fetchBrandProducts` |
| Public API | `web/app/api/catalog/route.ts` |
| Admin CRUD | `web/lib/inventory/products.ts` + `/api/inventory/products*` |
| Checkout enforcement | `web/app/api/orders/route.ts` + `getSellableStock` |
| Brand pages | `web/app/brands/[slug]/page.tsx` |
| Home Chloe Edit | Empty `products={[]}` — Shell V1 (locked) |

There is **no** `CREATE TABLE products` in repo migrations; the table predates numbered migrations and is only `ALTER`ed (see `docs/database/Schema.md`).

---

### 3. Current Product Model

**Canonical storefront type:** `web/lib/types.ts` → `Product`

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string \| number` | DB FKs treat as UUID |
| `sku` | `string \| null` | Business key |
| `name` | `string` | Title |
| `brand` | `string \| null` | Free text |
| `category` | `string \| null` | Free text |
| `description` | `string \| null` | |
| `barcode` | `string \| null` | EAN-style |
| `price` | `number \| null` | Console / portal sell price |
| `retail_price` | `number \| null` | |
| `shopify_price` | `number \| null` | Independent Shopify price |
| `cost_price` | `number \| null` | |
| `currency` | `string \| null` | Default mapped to `"CNY"` in `mapProduct` |
| `image_url` | `string \| null` | Primary image |
| `gallery_images` | `string[]` | |
| `stock` | `number \| null` | Denormalised on-hand |
| `presell_enabled` | `boolean \| null` | |
| `presell_quantity` | `number \| null` | |
| `expected_arrival_month` | `string \| null` | e.g. `2026-08` |
| `active` | `boolean \| null` | Storefront visibility gate |
| `status` | `string \| null` | Inventory lifecycle |
| `weight_grams` | `number \| null` | |
| `length_mm` / `width_mm` / `height_mm` | `number \| null` | |
| `created_at` / `updated_at` | `string \| null` | |

**Admin master type:** `web/types/inventory.ts` → `ProductMaster`  
Adds: `country_of_origin`, `hs_code`, `wholesale_price`, typed `status`, `tags`, `low_stock_threshold`.

**DB-only / not on storefront `Product`:** `organization_id`, `brand_id`, landed-cost columns (`factory_cost`, etc. from purchasing migration), etc.

**Row mapper:** `mapProduct` in `web/lib/brands/catalog.ts`.

**Not present on the model:** product slug, variant array, Shopify product ID, supplier SKU column, public PDP path.

---

### 4. Catalogue Source of Truth

| Role | System |
|------|--------|
| **Primary** | Supabase Postgres table `public.products` |
| **Secondary (inventory truth)** | `inventory_balances` + immutable `stock_movements` (ADR-002); `products.stock` is denormalised |
| **Secondary (brand UX)** | Code registry `web/lib/brands/registry.ts` (not product.brand alone) |
| **Secondary (purchasing brands)** | DB table `public.brands` + optional `products.brand_id` — admin purchasing, not storefront filter |
| **Import sources** | XLSX / PI sheets / Shopify JSON (scripts) — not live runtime sources |
| **Channel IDs** | `channel_product_mappings` (Joybuy foundation, migration `0013`) |
| **Caching** | No dedicated catalogue cache layer found; Next route `dynamic = "force-dynamic"` on `/api/catalog` |
| **Manual overrides** | Admin inventory UI; pricing/presell PATCH actions; one-off scripts |

---

### 5. Product Lifecycle

```
SOURCE (supplier sheets, PI, Shopify export JSON, Drive images)
   ↓
IMPORT (web/scripts/* — upsert on sku)
   ↓
DATABASE (public.products + optional ledger / storage URLs)
   ↓
NORMALISATION (partial — e.g. Tonies category script; brand matchNames; mapProduct defaults)
   ↓
APPLICATION (admin inventory, orders, brand catalog, APIs)
   ↓
STOREFRONT (brand pages + ProductCard today; Chloe Edit empty / Shell V1)
```

**Stages that are weak / incomplete today**

| Stage | Status |
|-------|--------|
| Source | Multiple brand-specific importers — works, not unified |
| Import | Script-driven; not a continuous sync pipeline |
| Database | Strong primary store |
| Normalisation | Ad hoc (no single normalised storefront DTO yet) |
| Application | Mature for ops + brand shop |
| Storefront Edit | Framework only — **not wired to catalogue** |

---

### 6. SKU & Identifier Model

#### SKU

| Question | Answer |
|----------|--------|
| Field | `sku` |
| Mandatory? | **No** (nullable in types and index) |
| Unique? | **Yes for non-null** — partial unique index `products_sku_key` (`0006_inventory_warehouse.sql`) |
| DB-enforced? | Yes (partial unique) |
| Duplicate non-null SKUs? | Prevented by DB |
| Multiple null SKUs? | **Possible** (index excludes nulls) |
| Variant-level SKUs? | N/A — no variants; one row ≈ one sellable SKU |
| Supplier vs internal SKU? | No separate supplier-SKU column; PO lines reuse `sku` |

Upserts use `onConflict: "sku"` across import scripts and `upsertProduct`.

#### Identifiers

| Identifier | Present? | Role |
|------------|----------|------|
| `products.id` | Yes | Internal PK (UUID in FKs) — **recommended stable storefront identity** |
| `sku` | Yes | Business / upsert / channel mapping key |
| `barcode` | Yes | Non-unique indexed lookup |
| Shopify product ID on product | **No** | Orders may carry draft order IDs only |
| Joybuy external IDs | Via `channel_product_mappings` | Not on `Product` type |
| Variant ID | **No** | |

**Recommendation for storefront identity:** use stringified `id` as React key and normalised `id`; keep `sku` for ops, channels, and optional display — never invent a second ID system.

---

### 7. Brand Model

| Aspect | Implementation |
|--------|----------------|
| On product | Free-text `products.brand` |
| Storefront resolution | `brandSlugFromProductBrand` / `matchNames` against `BRAND_REGISTRY` |
| Brand ID (storefront) | Slug string (`mideer`, `tonies`, `micro-scooters`) |
| Brand logo | Registry `logoUrl` under `/brands/*` — **not** on product rows |
| Brand URL | `/brands/[slug]` |
| DB purchasing brands | Separate `public.brands` + `brand_id` — parallel system |

**Active registry brands:** Mideer, Tonies, Micro Scooters.  
**Inactive placeholders:** Connetix, Le Toy Van.

**Risk:** free-text brand typos fail to match → product invisible on brand pages / Edit brand filters.

---

### 8. Category Model

| Aspect | Finding |
|--------|---------|
| Storage | Free-text `products.category` |
| Hierarchy | **None** in schema |
| IDs / slugs | **None** |
| Parent/child | **None** |
| Normalisation | Tonies-specific: `web/lib/brands/tonies-categories.ts` + script |
| UI | Category chips on some brand pages when browse enabled |

Do not redesign categories in 04A. Future merchandising may ignore category or map later.

---

### 9. Pricing Model

| Field | Role | Origin |
|-------|------|--------|
| `price` | Console / Thomas storefront sell price | Imports, `calcConsolePrice`, admin pricing, spreadsheet scripts |
| `retail_price` | Retail / RRP-ish | Often mirrored from price; imports |
| `shopify_price` | Independent Shopify price | Migration `0011`; admin; export scripts avoid overwriting casually |
| `cost_price` | Cost basis | Imports / admin |
| `wholesale_price` | Admin master | DB / ProductMaster |
| `currency` | Price currency | Default CNY; Tonies/Micro typically GBP |

**FX:** `web/lib/currency.ts` + tenant `cnyToGbpRate` / markup.  
**Precision:** DB `numeric(12,2)` for many money columns.  
**Tax:** No explicit VAT-inclusive flag on `Product`; not modelled as a storefront field today.

**For Chosen by Chloe Edit:** use **`price` + `currency`** (same as current ProductCard / ChloeEditGrid), not `shopify_price`, unless a channel-specific adapter is intentional.

---

### 10. Inventory Model

| Concept | Source |
|---------|--------|
| On-hand (denormalised) | `products.stock` ← `syncProductStock` from ledger |
| Ledger buckets | `inventory_balances` (available, allocated, reserved, incoming, …) |
| Sellable | **`getSellableStock`** = on-hand + presell (`web/lib/presell.ts`) |
| Presell | `presell_enabled`, `presell_quantity`, `expected_arrival_month` |
| Checkout | Orders enforce sellable stock |
| Discontinued | `status` / `active` flags — not a separate inventory state |

**Do not replace `getSellableStock`.** Future normalised `availability` should derive from it.

---

### 11. Image Model

| Field | Role |
|-------|------|
| `image_url` | Primary image URL |
| `gallery_images` | Ordered array (jsonb) |

**Storage:** Supabase Storage bucket `product-images` (env override `PRODUCT_IMAGE_BUCKET`); scripts upload by SKU and write public URLs onto product rows (`upload-product-images.ts`, Tonies/Micro image scripts, Drive matchers).

| Concern | Finding |
|---------|---------|
| Permanent vs signed | Written as **public** object URLs in normal flow — not short-lived signed URLs in app code reviewed |
| External hosts | Possible if a URL was pasted from Drive/CDN without upload |
| Broken-image risk | Missing `image_url`; deleted Storage objects; unmatched Drive imports |
| Thumbnails | No separate thumbnail field — clients use primary URL |

**Do not download/replace images in 04A.**

---

### 12. Product URL Model

| Mechanism | Status |
|-----------|--------|
| Product slug column | **Does not exist** |
| Public PDP route `/products/[…]` | **Does not exist** |
| Brand route | `/brands/[slug]` — catalogue by brand |
| Admin route | `/admin/inventory/products/[id]` |
| Shopify handle | Generated only in `export-shopify-csv.ts` via `handleFrom(sku, name)` — not stored |

**Current ChloeEditGrid behaviour:** links to brand slug page (or `/#chloe-edit` fallback) — **not** a product PDP.

**Gap for Shell target `productUrl`:** needs a future decision (introduce PDP, deep-link brand+sku query, or external Shopify URL). Design only in 04A — **do not implement**.

---

### 13. Visibility Model

| Flag | Storefront effect |
|------|-------------------|
| `active === true` | Required by `fetchCatalogProducts` and `/api/catalog` |
| `organization_id` | Tenant scope (Chosen by Chloe org) |
| `status` | Inventory lifecycle (`active` / `draft` / `discontinued`); discontinued tends to set `active` false on upsert |
| Brand `active` | Registry gate for brand pages / API brand filter |
| Sellable stock | Does **not** hide product; sold-out sorted last / labelled |

No separate “published for Chloe Edit” flag today. Merchandising selection is **not** modelled (deferred to 04B).

---

### 14. Variant Model

```
Product
  └── (no Variant[])
```

Architecture is **flat**: one database row per sellable SKU. Shopify/Micro imports flatten platform variants into separate products. Do not invent a variant tree for Shell V1.

---

### 15. Duplicate Risks

| Risk | Enforcement / evidence |
|------|------------------------|
| Duplicate non-null SKU | **Blocked** by partial unique index |
| Null SKU duplicates | **Possible** |
| Duplicate `id` | PK — blocked |
| Duplicate slug | N/A (no product slug) |
| Duplicate external ID | Channel mapping table uniqueness depends on `0013` constraints — review before Joybuy go-live |
| Brand free-text duplicates | Same brand, different spellings → match failure |

**Live duplicate counts:** not computed against production in this audit (no catalogue dump committed; avoid live mutation tooling). Future 04B prep: SQL count of null SKUs, unmatched brands, missing images among `active` rows.

---

### 16. Data Quality

| Field | Problem | Measurable in-repo? | Severity |
|-------|---------|---------------------|----------|
| `sku` | Nullable; nulls weaken upserts/channels | Needs live SQL | High if any active nulls |
| `brand` | Free text; unmatched → no brand page / weak Edit | Needs live SQL | High |
| `image_url` | Missing → blank cards | Needs live SQL | High for storefront |
| `price` | Null → cannot sell/display cleanly | Needs live SQL | Critical for commerce |
| `currency` | Defaulted to CNY in mapper if null — may mislabel GBP brands | Code path | Medium |
| `stock` vs ledger | Denormalised drift risk (TD / ADR dual write) | Ops monitoring | Medium |
| `category` | Inconsistent free text | Brand-specific | Low for Edit V1 |
| Product URL | No PDP | Architectural | High for rich commerce UX |
| Merchandising flags | None for “in Chloe Edit” | N/A | Expected — 04B |

**Sample evidence (not full catalogue):** `web/scripts/_mideer-pricing-audit.json` (dry-run 2026-08-27) summarises **87** MiDeer-focused rows with costs/prices present in that sample — **not** a full DQ census.

---

### 17. Chosen by Chloe Readiness

Target minimum storefront fields vs actual:

| Target | Current? | Ready? |
|--------|----------|--------|
| id | `Product.id` | Yes |
| sku | `Product.sku` | Yes (nullable caveat) |
| title | `Product.name` | Yes |
| brand | `Product.brand` (+ registry) | Yes with match risk |
| price | `Product.price` | Yes |
| currency | `Product.currency` | Yes |
| images[] | `image_url` + `gallery_images` | Yes (compose array) |
| availability | via `getSellableStock` | Yes (derive) |
| productUrl | **No first-class field/route** | **Gap** |

**Shell V1 ChloeEditGrid** already expects `Product` and renders image/brand/name/price/availability — but homepage must **not** be populated until merchandising rules exist (04B).

---

### 18. Gap Analysis

| Field | Current status | Source | Gap | Recommendation |
|-------|----------------|--------|-----|----------------|
| id | Present | `products.id` | TS allows `number` historically | Normalise to `string` in adapter |
| sku | Present, nullable | `products.sku` | Null SKUs | Exclude or fix before channel publish |
| title | Present as `name` | `products.name` | Naming mismatch only | Map `name` → `title` |
| brand | Free text | `products.brand` | No structured brand on product | Map string; optionally attach registry slug |
| price | Present | `products.price` | Which price for which channel | Thomas shell uses `price` |
| currency | Present | `products.currency` | Null defaults CNY | Preserve explicit currency; fail closed if missing for Edit |
| images | Split fields | `image_url`, `gallery_images` | Not a single array | Adapter: `[image_url, ...gallery].filter(Boolean)` |
| availability | Computed | `getSellableStock` | Not a stored enum | Adapter: `{ sellable, soldOut, presellOnly }` |
| productUrl | Missing | — | No PDP | Decide URL strategy before Edit deep-links; interim brand URL ok |

---

### 19. Proposed Normalized Product Model

**Proposal only — do not implement in 04A.**

```ts
// Proposed — future Sprint 04B+
type NormalizedAvailability = {
  sellableQuantity: number;
  soldOut: boolean;
  presellOnly: boolean;
  expectedArrivalMonth: string | null;
};

type NormalizedProduct = {
  id: string;                 // from products.id
  sku: string | null;
  title: string;              // from name
  brand: string | null;       // display brand
  brandSlug: string | null;   // from registry match
  price: number | null;       // portal price
  currency: string | null;
  images: string[];           // primary + gallery
  availability: NormalizedAvailability;
  productUrl: string;         // TBD strategy
  // optional passthrough
  category: string | null;
  barcode: string | null;
};
```

Mapping should reuse existing helpers: `mapProduct` field semantics, `getSellableStock`, `brandSlugFromProductBrand`, `formatPrice`.

---

### 20. Proposed Adapter Architecture

```
Thomas OS Catalogue
        ↓
Catalogue Adapter   ← owns Supabase / fetchCatalogProducts / filters
        ↓
NormalizedProduct[]
        ↓
Chosen by Chloe Storefront (Shell V1)
        ↓
ChloeEditGrid
```

**Principles**

- Shell components consume **NormalizedProduct** (or today’s `Product` via a thin adapter) — **not** raw Supabase queries in page components long-term.
- Shopify / Joybuy adapters produce the **same** normalised shape.
- Merchandising (which SKUs appear in The Chloe Edit) is a **separate** filter/order step after normalisation (04B).

**Do not implement the adapter in 04A.**

---

### 21. Shopify Compatibility

| Topic | Implication |
|-------|-------------|
| Flat SKU rows | Aligns with current Shopify CSV export (one variant row per product) |
| `shopify_price` | Separate field — Shopify adapter may prefer it over `price` |
| Handles | Generated at export; not stored — Shopify adapter should map Shopify handle/URL → `productUrl` |
| Variants | If Shopify multi-variant products are imported, continue flattening or extend model later |
| Images | Shopify CDN URLs can fill `images[]` via adapter |

Normalised model is **compatible** if adapters map title/price/image/availability/URL explicitly.

---

### 22. Joybuy Compatibility

| Topic | Implication |
|-------|-------------|
| Existing | `JoybuyMappedProduct` / inventory mappers already derive from Thomas `Product` |
| Stock | Joybuy inventory mapping reuses `getSellableStock` |
| External IDs | `channel_product_mappings` |
| Official API fields | Intentionally not assumed — HTTP adapter pending approval |

Normalised storefront model can sit **beside** Joybuy mapped types; do not conflate channel export payloads with Shell UI model.

Joybuy Open Platform remains a **separate workstream**.

---

### 23. Risks

| Risk | Severity | Evidence | Recommendation |
|------|----------|----------|----------------|
| Duplicate / null SKUs | High | Partial unique index allows nulls | Audit active null SKUs before Edit publish |
| Missing images | High | `image_url` nullable; image scripts optional | Require image for Edit eligibility |
| Missing / wrong prices | Critical | Multi-price fields; currency default CNY | Validate price+currency per brand |
| Inventory inconsistency | Medium | Dual `stock` + ledger (ADR-002) | Trust `getSellableStock`; monitor sync |
| Brand free-text mismatch | High | `matchNames` heuristics | Normalise brand labels; report unmatched |
| External / broken images | Medium | Storage vs pasted URLs | Prefer bucket URLs; soft-fail UI |
| Variant complexity later | Medium | Flat model vs future Shopify variants | Keep flat until product decision |
| No productUrl / PDP | High | No route/slug | Decide URL strategy before rich Edit |
| Shell querying DB directly | Medium | Architectural smell for multi-channel | Introduce adapter before multi-platform |
| Accidental merchandising dump | High | Full `fetchCatalogProducts` is large | Never dump all SKUs into Chloe Edit |

---

### 24. Recommended Next Steps

1. **Keep Shell V1 locked** — no visual changes.  
2. **Sprint 04B (suggested):** live DQ queries (counts for null sku/price/image/unmatched brand among active products); define Chloe Edit eligibility rules; implement **Catalogue Adapter → NormalizedProduct** (or thin map); **select** curated products (human/editorial — not “all active”).  
3. **Defer** Shopify live sync and Joybuy HTTP until adapters consume the same normalised model.  
4. **Decide productUrl strategy** before shipping clickable Edit cards to PDPs.  
5. **Do not** import new SKUs or mutate catalogue as part of “making the homepage look full.”

---

## Data Mapping Table

| Storefront Field | Thomas OS Field | Source | Transformation | Status |
|------------------|-----------------|--------|----------------|--------|
| id | `products.id` | Supabase | `String(id)` | Ready |
| sku | `products.sku` | Supabase | passthrough | Ready (nullable risk) |
| title | `products.name` | Supabase | rename | Ready |
| brand | `products.brand` | Supabase | passthrough; optional registry slug | Ready |
| price | `products.price` | Supabase | Number | Ready |
| currency | `products.currency` | Supabase | default `"CNY"` in `mapProduct` | Ready (watch defaults) |
| images | `image_url` + `gallery_images` | Supabase / Storage | compose array | Ready |
| availability | `stock` + presell_* | Supabase + `getSellableStock` | derive | Ready |
| productUrl | — | — | TBD (PDP / brand / Shopify) | **Gap** |

---

## Risk Register

| Risk | Severity | Evidence | Recommendation |
|------|----------|----------|----------------|
| duplicate / null SKU | High | Partial unique index | Pre-publish SQL audit |
| missing images | High | Nullable `image_url` | Edit eligibility requires image |
| missing prices | Critical | Nullable `price` | Exclude from Edit |
| inventory inconsistencies | Medium | ADR-002 dual representation | Use `getSellableStock` only |
| brand inconsistencies | High | Free-text vs registry | Unmatched-brand report |
| external image reliability | Medium | Non-bucket URLs possible | Prefer Storage public URLs |
| variant complexity | Medium | Flat catalogue | Stay flat for Shell V1 |
| external platform mapping | Medium | Shopify price vs portal price; Joybuy pending | Channel-specific adapters |

---

## Files inspected (non-exhaustive)

- `web/lib/types.ts`, `web/types/inventory.ts`
- `web/lib/brands/catalog.ts`, `match.ts`, `registry.ts`
- `web/lib/presell.ts`, `web/lib/currency.ts`, `web/lib/pricing.ts`
- `web/app/api/catalog/route.ts`, `web/app/api/orders/route.ts`
- `web/lib/inventory/products.ts`, `web/lib/inventory/movements.ts`
- `web/supabase/migrations/0006_*.sql`, `0010_presell.sql`, `0011_shopify_price.sql`, `0013_channel_connections.sql`
- `web/lib/integrations/joybuy/types.ts`
- `web/components/shop/ChloeEditGrid.tsx` (contract only — not modified)
- `docs/database/Schema.md`, `docs/adr/ADR-002-Inventory.md`
- Import/image scripts under `web/scripts/`

## Production behaviour

**No production code or data was modified in Sprint 04A.**

## Recommended commit (when you choose to commit)

```text
docs: audit Thomas OS catalogue for storefront integration
```

File to add: `docs/thomas-os-catalogue-audit-04a.md`
