# Joybuy Launch Audit

**Date:** 2026-09-07  
**Workstream:** Urgent Joybuy store launch audit  
**Scope:** Determine what exists vs what blocks launch of the Chosen by Chloe **Active Assortment** to Joybuy  
**Constraints observed:** No storefront changes · No assortment_status mutations · No Shopify work · No production Joybuy API calls · No rebuild of existing Joybuy foundation

---

## Executive Summary

Thomas OS already has a **Joybuy connector foundation** under `web/lib/integrations/joybuy/`: typed mappers (product / price / inventory), idempotent SKU↔external-ID helpers, sync orchestration stubs, admin status UI, callback placeholder, and unit tests.

**Nothing can go live yet.** Live HTTP, auth/signing, create/update/publish APIs, brand/category ID mappings, and environment selection are **not implemented**. Credentials are **absent** in the current environment. Sync still loads products with `active = true` only — **not** `assortment_status = 'active'`.

| Question | Answer |
|----------|--------|
| Integration exists? | **Yes — foundation / stubs** |
| Reusable? | **Yes — mappers, types, sync skeleton, mapping table design** |
| Auth implemented? | **No** (placeholder throws `JOYBUY_NOT_IMPLEMENTED`) |
| Product create API? | **No** (client stub) |
| Product publish API? | **No** (not even stubbed as a method) |
| Category mapping (Joybuy IDs)? | **No** (string names only) |
| Brand mapping (Joybuy IDs)? | **No** (string names only) |
| Inventory mapping? | **Yes (Thomas → payload)** via `getSellableStock()` |
| Image mapping? | **Yes (URLs → payload)** |
| Assortment gate? | **No** — gate should be added in `sync.ts` → `loadProducts()` |
| Active Assortment count (live DB) | **53** products with `assortment_status = 'active'` (business target ~50) |
| Dry-run | **Yes** — `web/scripts/joybuy-dry-run.ts` (mapper only, no HTTP) |

**Bottom line:** Do not rebuild Joybuy. Next sprint must wire official Open Platform auth + product APIs on top of existing mappers, add the assortment gate, and confirm Joybuy-side category/brand/store config — then dry-run → one test SKU → 53 Active products.

---

## Existing Integration

### Component inventory

| FILE | PURPOSE | STATUS | REUSABLE? | MISSING? | BLOCKED? |
|------|---------|--------|-----------|----------|----------|
| `web/lib/integrations/joybuy/config.ts` | Env config + presence checks | Complete for v1 env model | Yes | Sandbox vs prod distinction | Credentials empty |
| `web/lib/integrations/joybuy/auth.ts` | Auth / token resolution | Stub only | Skeleton yes | Signing, OAuth, refresh | Official Joybuy auth docs + app approval |
| `web/lib/integrations/joybuy/client.ts` | HTTP client interface | Stub — all methods throw | Interface yes | Real endpoints, HTTP, response parse | Auth + official API paths |
| `web/lib/integrations/joybuy/products.ts` | Thomas → `JoybuyMappedProduct` | Working mapper | Yes | Joybuy field-name translation | Official product schema |
| `web/lib/integrations/joybuy/pricing.ts` | Thomas → price payload | Working mapper | Yes | Sale/RRP split if Joybuy requires | Official price schema |
| `web/lib/integrations/joybuy/inventory.ts` | Thomas → inventory via `getSellableStock()` | Working mapper | Yes | Channel-specific availability flags if required | Official inventory schema |
| `web/lib/integrations/joybuy/mapping.ts` | SKU ↔ external ID idempotency | Complete helpers | Yes | DB persistence after successful create | API create returning external IDs |
| `web/lib/integrations/joybuy/sync.ts` | Orchestrate product/inventory/price/order sync | Skeleton calls client | Yes | Assortment gate; persist mappings | Client not implemented |
| `web/lib/integrations/joybuy/orders.ts` | Order normalize / build helpers | Partial stubs | Yes | Import into Thomas orders | Official order schema; **post-launch OK** |
| `web/lib/integrations/joybuy/fulfilment.ts` | Shipment payload builder | Working stub | Yes | Carrier code mapping if required | Official fulfilment schema; **post-launch OK** |
| `web/lib/integrations/joybuy/types.ts` | Channel-neutral types | Complete for foundation | Yes | Official Joybuy DTO types | Docs |
| `web/lib/integrations/joybuy/errors.ts` | Typed errors + failure helper | Complete | Yes | — | — |
| `web/lib/integrations/joybuy/log.ts` | Structured safe logging | Complete | Yes | — | — |
| `web/lib/integrations/joybuy/status.ts` | Admin/channel status | Complete (hardcoded pending review) | Yes | Dynamic review status from Joybuy | App approval |
| `web/lib/integrations/joybuy/index.ts` | Public exports | Complete | Yes | — | — |
| `web/lib/integrations/joybuy/__tests__/mapping.test.ts` | Mapper + config + idempotency tests | Passing design | Yes | Live API tests (intentionally absent) | — |
| `web/app/api/integrations/joybuy/callback/route.ts` | OAuth/callback placeholder | Returns 501 | Path yes | Real protocol | Official callback contract |
| `web/app/api/integrations/joybuy/status/route.ts` | Staff status API | Working | Yes | — | — |
| `web/app/api/integrations/joybuy/sync/route.ts` | Staff sync trigger | Working → stubs | Yes | Dry-run mode flag | Client |
| `web/app/admin/integrations/joybuy/page.tsx` | Admin Joybuy UI | Working | Yes | Publish/dry-run UX | Credentials + API |
| `web/supabase/migrations/0013_channel_connections.sql` | `channel_connections` + `channel_product_mappings` | Defined | Yes | Confirm applied on production Supabase | Ops |
| `docs/integrations/JOYBUY_IMPLEMENTATION.md` | Architecture notes | Accurate for foundation | Yes | Update after this launch audit | — |
| `docs/integrations/JOYBUY_CHECKLIST.md` | Older checklist | Useful | Yes | Superseded by this audit checklist | — |
| `web/scripts/joybuy-dry-run.ts` | Safe payload dry-run | **Added this audit** | Yes | — | — |

### Intended product flow (what exists)

```
Thomas OS Product (DB)
        ↓
loadProducts() in sync.ts          ← filters active=true ONLY today
        ↓
mapProductToJoybuy / buildJoybuy*  ← EXISTS (channel-neutral payload)
        ↓
resolveProductSyncAction           ← EXISTS (create vs update by SKU map)
        ↓
JoybuyClient.createProduct/update  ← STUB (throws NOT_IMPLEMENTED)
        ↓
Joybuy product listing             ← DOES NOT EXIST YET
```

---

## Authentication

| Capability | Status |
|------------|--------|
| Token / OAuth flow | **MISSING** — `authenticateJoybuy()` throws |
| Signature generation | **MISSING** — explicitly not invented |
| Timestamp handling | **MISSING** |
| Request signing | **MISSING** |
| Refresh behaviour | **MISSING** |
| Access token usage | Config reads `JOYBUY_ACCESS_TOKEN` but `getJoybuyAccessToken()` throws |
| Callback handling | Route exists; returns **501** `JOYBUY_NOT_CONFIGURED`; does not parse body |

**Verdict:** Authentication does **not** exist beyond config placeholders. External dependency: Joybuy app approval + official Open Platform auth docs.

---

## App Configuration

### Environment variables expected (names only — no values)

| Variable | Required for “configured”? | Purpose |
|----------|----------------------------|---------|
| `JOYBUY_APP_KEY` | Yes | Open Platform app key |
| `JOYBUY_APP_SECRET` | Yes | App secret (server-only) |
| `JOYBUY_ACCESS_TOKEN` | Yes | Access token once issued |
| `JOYBUY_API_BASE_URL` | Yes | Official API base URL |
| `JOYBUY_CALLBACK_URL` | Optional | Registered callback URL |

Documented in `web/.env.example` and `docs/integrations/JOYBUY_IMPLEMENTATION.md`.

### Live environment presence (this audit)

All five variables: **absent / empty** in the audited runtime (presence flags false). No secrets exposed.

### Callback URL (documented, not invented)

Registered path in code comments:

`https://<THOMAS_OS_DOMAIN>/api/integrations/joybuy/callback`

Do not change Joybuy developer-console configuration from this workstream.

### Admin status hardcodes

`status.ts` currently hardcodes:

- App name: Thomas OS  
- Business type: ISV Applications  
- App type: ERP Management  
- Review status: `pending_review`  

Treat app approval/review as **EXTERNAL**.

---

## Product Mapping

Mapper: `mapProductToJoybuy()` in `web/lib/integrations/joybuy/products.ts`  
Source type: `Product` in `web/lib/types.ts`

| Field | Mapped? | Notes |
|-------|---------|-------|
| product ID | Yes | `internalProductId` |
| SKU | Yes | Required; throws if blank |
| name → title | Yes | |
| description | Yes | |
| brand | Yes | **string name only** — no Joybuy brand ID |
| category | Yes | **string name only** — no Joybuy category ID |
| price | Yes | Catalog `price` |
| currency | Yes | |
| images | Yes | `image_url` + `gallery_images` |
| stock | Via inventory mapper | Not on product payload directly |
| dimensions / weight | Yes | mm / grams |
| barcode | Yes | |
| retail_price | Partial | In `attributes.retail_price` only |
| variants | **No** | `variant_group_key` / options not mapped |
| assortment_status | **No** | Not read by mapper or sync loader |

---

## Price Mapping

`buildJoybuyPricePayload()`:

| Thomas | Joybuy payload | Gap |
|--------|----------------|-----|
| `price` | `price` (rounded via `round2`) | — |
| `currency` | `currency` | — |
| `retail_price` | Not on price payload | If Joybuy needs RRP / list price separately → gap |
| Sale / promo price | Not modelled | Gap if Joybuy requires sale vs RRP |
| `cost_price` | Intentionally omitted | Correct |

Do not change pricing logic until official Joybuy price schema is confirmed.

---

## Inventory Mapping

`buildJoybuyInventoryPayload()` **reuses** existing Thomas helpers:

- `quantity` = `getSellableStock(product)` (on-hand + presell)
- `onHand` = `getOnHandStock(product)`
- `presell` = `getPresellStock(product)`
- `expectedArrivalMonth` = `product.expected_arrival_month`

**Does not replace** `getSellableStock()`.  
Availability boolean / warehouse ID for Joybuy: **not mapped** (may be merchant-console or official API fields later).

---

## Image Mapping

| Source | Mapping |
|--------|---------|
| `image_url` | `primaryImageUrl` |
| `gallery_images` | `galleryImageUrls` (trimmed; empties dropped) |
| Fallback | If no `image_url`, first gallery URL becomes primary |

URLs are passed through as-is (typically HTTPS CDN / Supabase storage). Compatibility with Joybuy media upload rules is **unverified** (official media API not confirmed). Do not download/replace images in this workstream.

---

## Brand Mapping

| Item | Status |
|------|--------|
| Brand string from Thomas | Mapped |
| Joybuy brand ID lookup table | **MISSING** |
| Admin brand mapping UI | **MISSING** |

If Joybuy requires registered brand IDs, that is Joybuy-side + Thomas mapping config — **do not invent IDs**.

---

## Category Mapping

| Item | Status |
|------|--------|
| Category string from Thomas | Mapped |
| Joybuy category tree / IDs | **MISSING** |
| Category mapping table | **MISSING** |

Many Active products may have empty `category` (dry-run sample showed `—`). Confirm Joybuy requirements before launch.

---

## Product Publishing

| Operation | Client method | Status |
|-----------|---------------|--------|
| create product | `createProduct` | Stub → throws |
| update product | `updateProduct` | Stub → throws |
| get product | `getProduct` | Stub → throws |
| publish / activate | — | **Not present** |
| unpublish | — | **Not present** |

Sync planner (`resolveProductSyncAction`) correctly decides create vs update from `channel_product_mappings`, but never reaches a live API.

---

## Store Configuration

| Concern | In repo? |
|---------|----------|
| Store / shop identifier | **Not defined** as a dedicated env var |
| Merchant identifier | Only via future `channel_connections.external_account_id` |
| Site / market / country | **Not coded** |
| Currency | Per-product `currency` on payloads |

Do not assume store IDs. Confirm from Joybuy Open Platform / merchant console after app approval. `channel_connections` row for `joybuy` is seeded as `pending` in migration 0013.

---

## Order / Fulfilment Requirements

### Orders

| For initial store listing launch | Assessment |
|----------------------------------|------------|
| Order API | **Not required for launch** of the 50/53 product catalogue |
| Order import into Thomas | **Future** (stubs exist) |
| After first sales | **P1 soon after launch** — without order pull, Joybuy sales won’t enter Thomas warehouse |

### Fulfilment

Shipment payload builder exists (`buildJoybuyShipmentPayload`). Shipping templates / warehouse / delivery settings: **not API-configured in Thomas**; treat as **merchant-console** until official fulfilment API is confirmed. Do not change merchant-console from this audit.

---

## Assortment Gate

**Current behaviour:** `loadProducts()` in `web/lib/integrations/joybuy/sync.ts` filters:

```ts
.eq("active", true)
```

Mapper additionally sets `active: product.active !== false && product.status !== "discontinued"`.

**Required for launch:** Joybuy must consume `assortment_status = 'active'` (not merely `active = true`).

**Gate location (DO NOT implement in this audit):**

- Primary: `web/lib/integrations/joybuy/sync.ts` → function `loadProducts()`
- Dry-run already scopes to `assortment_status = 'active'` in `web/scripts/joybuy-dry-run.ts`
- Optional defence-in-depth: refuse sync if `product.assortment_status !== 'active'` inside `syncProductToJoybuy`

**Live counts (2026-09-07):**

| Metric | Count |
|--------|------:|
| Total products | 1987 |
| `active = true` | 1932 |
| `assortment_status = active` | **53** |
| `assortment_status = paused` | 8 |
| `assortment_status = retired` | 607 |
| `assortment_status` null | 1319 |

Business target remains ~50 Active; live DB currently shows **53**. Do not change assortment in this workstream — reconcile count in assortment admin separately if needed.

---

## Launch Blockers

| Blocker | Severity | Technical/External | Action |
|---------|----------|--------------------|--------|
| Joybuy app still Pending Review / no credentials | P0 | External | Await Open Platform approval; then set env vars |
| Official API base URL / schemas not confirmed | P0 | External + Technical | Obtain docs; set `JOYBUY_API_BASE_URL` |
| Auth / signing not implemented | P0 | Technical | Implement in `auth.ts` + `client.ts` per official docs only |
| Product create/update HTTP not implemented | P0 | Technical | Wire adapter; keep mappers |
| Product publish/activate not defined | P0 | Technical + External | Confirm if create implies live, or separate publish API |
| Assortment gate missing (`active` vs `assortment_status`) | P0 | Technical | Add filter in `sync.ts` `loadProducts()` |
| Joybuy category IDs unknown | P0/P1 | External + Technical | Confirm requirement; map Active products if required |
| Joybuy brand IDs unknown | P1 | External + Technical | Confirm requirement; map brands if required |
| Media upload rules unverified | P1 | External | Confirm URL vs upload API |
| Migration 0013 apply status unverified | P1 | Technical/Ops | Verify `channel_connections` / `channel_product_mappings` on prod |
| Sandbox vs production env unclear | P0 | Technical | Confirm official environments before any write |
| Order sync not built | P2 | Technical | Post-launch sprint |
| Fulfilment / shipment update not live | P2 | Technical | Post-launch sprint |
| Variant mapping absent | P2 | Technical | Only if Active set includes multi-SKU variants needing Joybuy variants |
| Active count 53 vs business “50” | P1 | Business | Reconcile in assortment admin (no code change here) |

---

## 50 Product Launch Scope

- **In scope:** products with `assortment_status = 'active'` (live: **53**)
- **Out of scope:** 668 historical / full catalogue, paused, retired, null assortment, Shopify, storefront redesign
- Sync must never default to all `active = true` (~1932) products

---

## Dry Run

**Capability:** `web/scripts/joybuy-dry-run.ts`

```bash
cd web
npx tsx scripts/joybuy-dry-run.ts
npx tsx scripts/joybuy-dry-run.ts --limit 5
npx tsx scripts/joybuy-dry-run.ts --sku CT0610
```

- Loads `assortment_status = 'active'` only  
- Uses existing mappers for product / price / inventory  
- Writes JSON under `web/tmp/joybuy-dry-run/`  
- **Does not** import or call `getJoybuyClient`  

Verified during this audit (sample 3 Mideer SKUs mapped successfully).

---

## Launch Checklist

### Joybuy Launch Checklist

| Item | Status |
|------|--------|
| App approved | **EXTERNAL** (code assumes `pending_review`) |
| Credentials configured | **MISSING** (env presence false) |
| Callback/auth complete | **PARTIAL** (route exists; protocol + auth missing) |
| Store identified | **MISSING** |
| Product mapper complete | **PARTIAL** (Thomas payload yes; Joybuy DTO translation no) |
| Category mapping complete | **MISSING** |
| Brand mapping complete | **MISSING** |
| Price mapping complete | **PARTIAL** (sell price yes; RRP/sale TBD) |
| Inventory mapping complete | **PARTIAL** (Thomas payload yes; API wire no) |
| Image mapping complete | **PARTIAL** (URL mapping yes; media API TBD) |
| Assortment gate complete | **MISSING** (dry-run yes; sync loader no) |
| Product create API complete | **MISSING** |
| Product update API complete | **MISSING** |
| Product publish API complete | **MISSING** |
| Test product successfully created | **MISSING** |
| Production launch approved | **EXTERNAL** |

---

## Recommended Implementation Order

1. **Confirm external deps** — app approved; official auth + product + inventory + media docs; sandbox vs production base URLs.  
2. **Configure env** — `JOYBUY_*` on Vercel/server only; register callback URL in Joybuy console (ops).  
3. **Verify migration 0013** on production Supabase.  
4. **Implement auth + signed client** in `auth.ts` / `client.ts` only (no mapper rewrite).  
5. **Add assortment gate** in `sync.ts` `loadProducts()` → `.eq("assortment_status", "active")`.  
6. **Category/brand mapping** if Joybuy requires IDs (config table or admin tool — do not invent IDs).  
7. **Dry-run full Active set** via `joybuy-dry-run.ts`; fix data gaps (missing images/SKU/price).  
8. **Sandbox: one test SKU** create → update → inventory → (publish if required).  
9. **Sandbox: full Active Assortment** sync; persist `channel_product_mappings`.  
10. **Production authorization** → publish Active set only.  
11. **Post-launch:** order import + fulfilment updates (P2 → next sprint).

---

## Final Output (Q&A)

1. **What already exists?** Full Joybuy foundation: mappers, sync stubs, client interface, admin UI, callback stub, mapping migration, tests, docs.  
2. **What is reusable?** Almost all of `web/lib/integrations/joybuy/*` except stubbed HTTP bodies.  
3. **What is missing?** Auth/signing, live HTTP, publish API, assortment gate in sync, brand/category IDs, store ID, credentials, confirmed API schemas.  
4. **Exact launch blockers?** See Launch Blockers table (P0: approval, credentials, auth, create/publish APIs, assortment gate, API environment clarity).  
5. **Authentication exists?** **No** (stubs only).  
6. **Product creation exists?** **Mapper yes / API no**.  
7. **Product publishing exists?** **No**.  
8. **Category mapping exists?** **String only — no Joybuy IDs**.  
9. **Brand mapping exists?** **String only — no Joybuy IDs**.  
10. **Inventory mapping exists?** **Yes** (payload via `getSellableStock()`).  
11. **Image mapping exists?** **Yes** (URL pass-through).  
12. **assortment_status gate exists?** **No** in sync; **yes** in dry-run script. Add at `sync.ts` → `loadProducts()`.  
13. **Number of current Active products?** **53** (`assortment_status = 'active'`).  
14. **Dry-run capability?** **Yes** — `web/scripts/joybuy-dry-run.ts`.  
15. **Exact files involved?** Listed in Existing Integration table.  
16. **Recommended next sprint?** Auth + client against official docs → assortment gate → category/brand if required → sandbox one SKU → Active Assortment sync. **Do not rebuild.**

---

## Related docs

- `docs/integrations/JOYBUY_IMPLEMENTATION.md`  
- `docs/integrations/JOYBUY_CHECKLIST.md`  
- `docs/assortment-status-05c.md`  
- `docs/assortment-admin-05d.md`  
- `docs/catalogue-lifecycle-05b.md`
