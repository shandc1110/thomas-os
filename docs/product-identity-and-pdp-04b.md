# Product Identity & PDP Architecture

## Sprint 04B

**Status:** Implemented (no database migration)  
**Baseline:** Storefront Shell V1 locked · Catalogue audit 04A complete  
**Route:** `/products/[slug]`

---

### Current Product Model

Canonical storefront type: `web/lib/types.ts` → `Product`

No replacement interface was created. PDP and slug utilities consume the existing `Product` type.

Row mapping: `web/lib/products/map-product.ts` → `mapProduct()` (shared with `fetchCatalogProducts`).

---

### Current Routing

| Route | Purpose |
|-------|---------|
| `/` | Home (Shell V1 — Chloe Edit empty) |
| `/brands` | Brand index |
| `/brands/[slug]` | Brand catalogue |
| **`/products/[slug]`** | **Product detail page (04B)** |
| `/checkout` | Basket / checkout |
| `/admin/inventory/products/[id]` | Staff product admin |

Framework: Next.js App Router (`web/app/`).

---

### Product Identity

| Identifier | Role |
|------------|------|
| `products.id` | **Stable internal identity** (UUID in current DB) |
| `sku` | Business key; upsert key; nullable |
| Public slug | **Derived** — not stored in DB (Sprint 04B) |

**Stable storefront identity:** stringified `products.id`, embedded in public slug suffix.

---

### Slug Strategy

**Format:** `{brandSlug}-{nameSlug}-{id}`

| Segment | Source |
|---------|--------|
| `brandSlug` | `brandSlugFromProductBrand(brand)` or slugified brand text |
| `nameSlug` | `slugifySegment(name)` (max 48 chars) |
| `id` | `String(product.id)` — full UUID or numeric id |

**Properties**

- Human-readable prefix (brand + name)
- Deterministic and unique (id suffix prevents collisions)
- Stable when price, stock, presell, or images change
- If product **name** changes, canonical slug changes — lookup still works via id suffix; non-canonical URLs redirect to canonical

**Not used as sole public slug:** random-looking id-only URLs, SKU-only URLs (SKU nullable and may change).

**Implementation:** `web/lib/products/slug.ts`

---

### URL Contract

```ts
productUrl(product): string
// → "/products/{buildProductSlug(product)}"
```

Future normalised model:

```ts
productUrl: string  // canonical path, not constructed in UI
```

---

### PDP Route

**File:** `web/app/products/[slug]/page.tsx`

- Resolves slug → `fetchProductBySlug(slug)`
- Active + tenant-scoped products only
- Redirects non-canonical slug variants to canonical `productUrl`
- `notFound()` when id cannot be resolved
- Uses Shell V1 chrome: `ShopHeader`, `ShopFooter`

**Not found:** `web/app/products/[slug]/not-found.tsx`

---

### Product Lookup

**File:** `web/lib/products/lookup.ts`

```
slug → extractProductIdFromSlug(slug) → fetchActiveProductById(id) → Product
```

- No duplicate catalogue
- No hardcoded products
- No separate PDP database

---

### Product Data Requirements

PDP displays actual `Product` fields only:

| Display | Field |
|---------|-------|
| Name | `name` |
| SKU | `sku` (if present) |
| Brand | `brand` (+ link to brand page when matched) |
| Price | `price` + `formatPrice` |
| Currency | `currency` |
| Images | `image_url` + `gallery_images` |
| Availability | `getSellableStock`, presell helpers |
| Description | `description` (if present) |
| Dimensions | `weight_grams`, `length_mm`, `width_mm`, `height_mm` (if present) |

No fake reviews, ratings, or invented metadata.

---

### Image Architecture

Reuses existing fields:

- `image_url` — primary
- `gallery_images` — additional images

`ProductGallery` composes primary + gallery without a new image system.

---

### Brand Architecture

Reuses `brandSlugFromProductBrand()` for slug prefix and brand page links.

Brand pages remain separate destinations:

- Product card → `/products/[slug]`
- Brand name link on PDP → `/brands/[slug]`

---

### Inventory Architecture

Reuses `getSellableStock()` and related presell helpers from `web/lib/presell.ts`.

No new inventory logic.

---

### Pricing Architecture

Reuses `price`, `currency`, and `formatPrice()` from `web/lib/format.ts`.

No FX, Shopify price, or Joybuy price logic on PDP.

---

### Basket Integration

Reuses existing `CartContext`:

- `ProductPurchase` mirrors `ProductCard` add-to-basket behaviour
- `addItem(product, quantity)` with sellable stock clamping
- No new basket system; checkout unchanged

---

### SEO / Metadata

`generateMetadata` on PDP derives from product data:

- `title`: product name + brand display name
- `description`: product description or brand + name
- `canonical`: `{origin}/products/{canonicalSlug}`
- Open Graph image when `image_url` present

No invented SEO copy or structured data.

---

### Normalized Product Relationship

Sprint 04A proposed:

```
Thomas OS Product → Catalogue Adapter → NormalizedProduct → UI
```

Sprint 04B adds **`productUrl`** at the utility layer without implementing full `NormalizedProduct`:

| Field | 04B status |
|-------|------------|
| `productUrl` | `productUrl(product)` in `slug.ts` |
| Adapter layer | **Not implemented** — documented for 04C+ |

`ChloeEditGrid` now links via `productUrl(product)` (navigation contract; grid still empty on homepage).

---

### Shopify Compatibility

Shopify handles can be mapped to the same slug pattern or stored slug column later.

`export-shopify-csv.ts` uses a simpler `handleFrom(sku, name)` — Shopify adapter may map:

| Shopify | Thomas / normalised |
|---------|---------------------|
| handle | slug prefix or stored slug |
| title | `name` |
| variant SKU | `sku` |
| price | `shopify_price` or `price` (channel policy) |
| images | `image_url` / gallery |
| URL | `/products/{slug}` on Thomas shell |

---

### Joybuy Compatibility

Joybuy mappers already derive from Thomas `Product`. PDP architecture is independent of Joybuy HTTP.

Future: same `productUrl` contract on normalised model; Joybuy external IDs remain in `channel_product_mappings`.

---

### Migration Requirements

**Database migration required?** **NO** (Sprint 04B)

Slug is derived at runtime. Lookup uses embedded `products.id`.

**Optional future migration (not executed):**

If human-readable slugs should remain stable when **product names change**, add:

```sql
alter table public.products
  add column if not exists slug text;

create unique index if not exists products_slug_key
  on public.products (slug)
  where slug is not null;
```

| Item | Proposal |
|------|----------|
| Backfill | `slug = buildProductSlug(product)` for active rows |
| Collisions | Unique index + id suffix strategy |
| Rollback | Drop column + index |
| Redirect | Keep id-suffix lookup during transition |

**Do not apply without explicit approval.**

---

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Long URLs (UUID suffix) | Low | Acceptable; optional short slug column later |
| Name change changes canonical slug | Medium | Id suffix still resolves; redirect to canonical |
| Slug without id invalid | Low | `notFound()` |
| Dual brand text vs registry | Medium | Reuse existing match helpers |
| No stored slug for external SEO history | Medium | Future `slug` column if needed |

---

### Next Steps

1. **Sprint 04C+:** Merchandising — select Chloe Edit products (not all catalogue).
2. **Sprint 04C+:** Catalogue adapter → `NormalizedProduct` including `productUrl`.
3. **Optional:** Persisted `slug` column if name-stable URLs required.
4. **Optional:** Link `ProductCard` on brand pages to PDP (currently grid-only add-to-basket).

---

### Components

| Component | Path |
|-----------|------|
| `ProductPageContent` | `web/components/products/ProductPageContent.tsx` |
| `ProductGallery` | `web/components/products/ProductGallery.tsx` |
| `ProductInformation` | `web/components/products/ProductInformation.tsx` |
| `ProductAvailability` | `web/components/products/ProductAvailability.tsx` |
| `ProductPurchase` | `web/components/products/ProductPurchase.tsx` |

### Libraries

| Module | Path |
|--------|------|
| Slug / URL | `web/lib/products/slug.ts` |
| Lookup | `web/lib/products/lookup.ts` |
| Mapper | `web/lib/products/map-product.ts` |
| Barrel | `web/lib/products/index.ts` |
