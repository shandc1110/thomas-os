# Catalogue Intelligence Audit

## Sprint 05A

**Status:** Read-only analysis — no product data modified  
**Generated:** 2026-08-27 (live Supabase snapshot)  
**Data source:** `LIVE_SUPABASE` — `public.products`  
**Tenant:** Chosen by Chloe (`organization_id` `00000000-0000-0000-0000-000000000001`)  
**Machine-readable output:** [`catalogue-intelligence-05a.json`](catalogue-intelligence-05a.json)

> **This sprint does not choose for Chloe.**  
> It makes the catalogue understandable. Facts, readiness, structure, and **catalogue-ready candidates** — not editorial selection.

---

### Executive Summary

Thomas OS holds a **live catalogue of 668 products** for Chosen by Chloe. The catalogue is largely storefront-ready at a technical level:

| Metric | Count |
|--------|------:|
| Total products | 668 |
| Active | 661 |
| Sellable (`getSellableStock` > 0) | 651 |
| Storefront-ready (identity + price + image + brand + PDP) | 645 |
| **Catalogue-ready candidates** | **623** |

**Primary gaps before human curation:** 23 products without primary images, 17 with zero sellable stock, 7 inactive, 208 without descriptions (PDP SEO only). No duplicate SKUs, no slug collisions, no unmatched brands.

**Merchandising schema:** No `chloe_edit`, `featured`, `editorial_rank`, or `hero_product` fields exist in the database.

**Next step:** Human curation from catalogue-ready candidates — not automated selection.

---

### Catalogue Overview

| Dimension | Value |
|-----------|-------|
| Data access | Live Supabase service role (read-only audit script) |
| Table | `public.products` |
| Total products | 668 |
| Active products | 661 |
| Inactive products | 7 |
| Sellable products | 651 |
| Presell-only sellable (on-hand 0, presell > 0) | 626 |
| Zero sellable stock | 17 |
| With primary image | 645 |
| Without primary image | 23 |
| With gallery images | 76 |
| Single image only (primary, no gallery) | 569 |
| With valid price + currency | 668 |
| Without valid price | 0 |
| With brand text | 668 |
| Without brand | 0 |
| Unmatched `BRAND_REGISTRY` | 0 |

**Currency distribution:** CNY 87 · GBP 581

**Price field divergence (informational):** 11 products where `shopify_price` ≠ `price`; 55 where `retail_price` ≠ `price`.

---

### Storefront Readiness

Readiness flags per product (see JSON for full candidate list):

| Flag | Definition |
|------|------------|
| `identity_ready` | Non-empty `name` and `sku` |
| `pricing_ready` | `price` > 0 and `currency` set |
| `image_ready` | Non-empty `image_url` |
| `brand_ready` | Brand text matches `BRAND_REGISTRY` |
| `availability_ready` | `getSellableStock()` > 0 |
| `description_ready` | Non-empty `description` |
| `pdp_ready` | Can build Sprint 04B slug + `productUrl` |
| `storefront_ready` | identity + pricing + image + brand + PDP |

**Catalogue Readiness Score (0–100)** — transparent formula:

| Dimension | Points |
|-----------|--------|
| Product name present | 10 |
| SKU present | 10 |
| Valid price + currency | 20 |
| Primary image | 20 |
| Brand text | 8 |
| Brand registry match | 7 |
| Description | 10 |
| Sellable stock | 15 |

This is **catalogue readiness**, not Chosen by Chloe editorial quality.

---

### Data Quality

| Issue | Product count | Severity | Recommendation |
|-------|---:|---|---|
| Missing primary image | 23 | high | Upload/match images or exclude from Edit until `image_url` set |
| Missing category | 87 | low | Optional for Edit V1; MiDeer-heavy |
| Missing description | 208 | low | PDP SEO; not blocking cards |
| Zero sellable stock | 17 | medium | Receive stock or presell before featuring |
| Inactive product | 7 | info | Excluded from public catalog API |
| Missing SKU | 0 | — | — |
| Missing price | 0 | — | — |
| Missing brand | 0 | — | — |
| Unresolved brand | 0 | — | — |
| Duplicate SKU groups | 0 | — | — |
| Slug collision groups | 0 | — | — |
| Suspicious image URLs | 0 | — | (heuristic only; no HTTP fetch) |

Example SKUs without images: `MD1494-CT01`, `11002434`, `11002433`, `11002730`, `11002432`.

---

### Brand Landscape

| Brand | Products | Active | Sellable | Image-ready | Price-ready | Avg readiness score |
|-------|---:|---:|---:|---:|---:|---:|
| Tonies | 435 | 428 | 435 | 426 | 435 | 100 |
| Micro Scooters | 146 | 146 | 146 | 134 | 146 | 90 |
| Mideer | 87 | 87 | 70 | 85 | 87 | 87 |

**Registry:** Active catalogue brands map to `mideer`, `tonies`, `micro-scooters`. Placeholder registry entries `connetix`, `le-toy-van` have no products.

**Brand naming:** No unmatched free-text brands in this snapshot. No duplicate brand labels detected at product level.

---

### Category Landscape

Top categories (full list in JSON):

| Category | Products | Active | Sellable |
|----------|---:|---:|---:|
| Stories & Songs | 161 | 161 | 161 |
| (no category) | 87 | 87 | 70 |
| Helmets | 61 | 61 | 61 |
| Disney | 50 | 50 | 50 |

87 products lack category (all MiDeer-weighted). Category is free-text — no hierarchy in schema.

---

### Inventory Landscape

Uses existing `getSellableStock()` = on-hand + presell pool.

| State | Count |
|-------|---:|
| Sellable | 651 |
| Presell-only sellable | 626 |
| Zero sellable | 17 |
| Active but not sellable | 10 (661 active − 651 sellable, overlap with inactive sellable edge cases) |

**Note:** Large presell-only pool reflects in-transit MiDeer stock model — technically sellable, operationally pre-order.

---

### Pricing Landscape

| Finding | Count |
|---------|---:|
| Valid console `price` + `currency` | 668 |
| CNY products | 87 |
| GBP products | 581 |
| `shopify_price` ≠ `price` | 11 |
| `retail_price` ≠ `price` | 55 |

No missing prices. Currency aligns with brand defaults (MiDeer CNY, Tonies/Micro GBP).

---

### SKU Landscape

| Finding | Count |
|---------|---:|
| Total SKUs (non-null) | 668 |
| Null SKUs | 0 |
| Duplicate non-null SKU groups | 0 |

SKU is mandatory in practice for this catalogue. DB partial unique index enforced.

---

### Product URL Readiness

Sprint 04B architecture: `buildProductSlug` → `/products/{brand}-{name}-{id}`.

| Finding | Count |
|---------|---:|
| Products with derivable PDP URL | 668 |
| Slug collision groups | 0 |

All active products with name + id resolve safely. Human-readable prefix may change if name changes; id suffix preserves lookup.

---

### Catalogue-Ready Candidates

**Label:** `CATALOGUE-READY CANDIDATE` — **not** “Chosen by Chloe”.

**Definition:** `active` AND identity_ready AND pricing_ready AND image_ready AND brand_ready AND pdp_ready AND sellable > 0.

| Count | 623 |
|-------|---:|

**623 of 668** products pass objective catalogue criteria. This is far larger than any realistic Chloe Edit — **human curation is required** to narrow selection.

Full candidate dataset (623 rows): see `candidates[]` in [`catalogue-intelligence-05a.json`](catalogue-intelligence-05a.json).

Sample top-scoring candidates (score 100):

| SKU | Name | Brand | Price | Currency | Sellable |
|-----|------|-------|-------|----------|---:|
| (see JSON) | — | Tonies-heavy | — | GBP | — |

Representative fields in JSON: `productId`, `sku`, `productName`, `brand`, `brandSlug`, `category`, `price`, `currency`, `sellableStock`, readiness booleans, `catalogueReadinessScore`, `productUrl`.

---

### Key Risks

1. **Over-selection risk** — 623 candidates is not an Edit; automated dump would violate editorial intent.
2. **Missing images (23)** — Block PDP-quality presentation until resolved.
3. **Presell-heavy catalogue** — 626 presell-only sellable; customer expectation management required in curation.
4. **MiDeer sellable gap** — 17 MiDeer SKUs not sellable vs 87 total; in-transit timing.
5. **Description gaps (208)** — Weak PDP SEO, not blocking cards.
6. **Dual price fields** — `shopify_price` / `retail_price` divergence may matter for channel adapters later.
7. **No merchandising flags** — Edit selection will need new data model or external curation list in a future sprint.

---

### Recommended Data Cleanup

1. Resolve 23 missing primary images (upload/match scripts).
2. Review 17 zero-sellable SKUs — activate presell or receive stock.
3. Optionally backfill MiDeer categories (87 uncategorised).
4. Optionally add descriptions for PDP SEO (208 gaps).
5. Do **not** bulk-publish all 623 candidates to Chloe Edit.

---

### Recommended Human Curation Process

| Step | Action | Automated? |
|------|--------|------------|
| 1 | Filter to catalogue-ready candidates (objective) | Yes (this audit) |
| 2 | **Human review** — remove unsuitable items | **Human** |
| 3 | **Brand fit** — aligns with Chosen by Chloe story | **Human** |
| 4 | **Product fit** — real-world usefulness for families | **Human** |
| 5 | **Child / family relevance** | **Human** |
| 6 | **Price / value judgement** | **Human** |
| 7 | **Editorial order** — Edit narrative, not database sort | **Human** |
| 8 | **Final Chloe Edit** — small curated set | **Human** |

Do not automate taste, judgement, or “what Chloe would choose.”

---

### Methodology & Limitations

| Item | Detail |
|------|--------|
| Script | `web/scripts/audit-catalogue-intelligence-05a.ts` (read-only, re-runnable) |
| Timestamp | `generatedAt` in JSON |
| Image check | URL pattern heuristic only — no HTTP fetch |
| Scope | Products only — no orders/customers |
| Mutations | None |

If live access unavailable in future runs, JSON will record `liveAccess: false` and empty metrics.

---

### Confirmation

- [x] No product INSERT / UPDATE / DELETE
- [x] No storefront Shell V1 changes
- [x] No Chloe Edit population
- [x] No merchandising rules implemented
- [x] No Shopify / Joybuy connection
- [x] No pricing or inventory modifications
