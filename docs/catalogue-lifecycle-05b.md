# Catalogue Lifecycle & Active Assortment

## Sprint 05B

**Status:** Read-only audit & architecture design — **no product data modified**  
**Baseline:** Sprint 05A catalogue intelligence (668 live products, 623 catalogue-ready candidates)  
**Principle:** Supabase `public.products` is the **product database**, not the **selling assortment**.

---

### Business Context

The business owner has clarified:

> Not every product in Supabase should continue to be sold.

Thomas OS holds a **broad historical and operational catalogue** (imports, supplier ranges, in-transit stock). Chosen by Chloe needs a deliberate **active assortment** layer without deleting historical records.

Required hierarchy:

```
PRODUCT HISTORY (all rows retained)
        ↓
ACTIVE ASSORTMENT (what we sell now)
        ↓
MERCHANDISING (future)
        ↓
THE CHLOE EDIT (editorial subset — not this sprint)
```

**Retain data. Control selling status.**

Sprint 05A’s **623 catalogue-ready candidates** are **technical readiness only** — not a keep list.

---

### Current Product Status Model

**Canonical type:** `web/lib/types.ts` → `Product`  
**Admin master:** `web/types/inventory.ts` → `ProductMaster` with `ProductStatus`

| Field | Type (app) | DB (migrations) |
|-------|------------|-----------------|
| `active` | `boolean \| null` | Exists on `products` (predates numbered migrations; not added in `0006`) |
| `status` | `string \| null` / `ProductStatus` | `text default 'active'` (`0006_inventory_warehouse.sql`); **no CHECK constraint** |
| `stock` | denormalised on-hand | integer |
| `presell_enabled`, `presell_quantity`, `expected_arrival_month` | presell pool | `0010_presell.sql` |

**Typed status values in code:** `active` | `draft` | `discontinued` (`ProductStatus`)

**Not present in schema:** `archived`, `published`, `hidden`, `chloe_edit`, `featured`, `editorial_rank`, `hero_product`, `assortment_status`

---

### Existing `active` Field

#### Semantics (from code — not assumed)

`products.active` is the **primary storefront and checkout gate** today.

| Behaviour | Detail |
|-----------|--------|
| **Storefront catalog** | `fetchCatalogProducts`, `GET /api/catalog` → `.eq("active", true)` |
| **PDP** | `fetchActiveProductById` → `.eq("active", true)` |
| **New orders** | `POST /api/orders` rejects items where `!product.active` |
| **Joybuy sync** | Loads `.eq("active", true)`; mapper also excludes `status === "discontinued"` |
| **Admin list** | `listProducts` → **no** `active` filter (all products visible) |
| **Admin get by id** | `getProductById` → **no** `active` filter |
| **Dashboard stats** | Includes all products regardless of `active` |

#### Written where

| Path | Logic |
|------|--------|
| `upsertProduct` | `active: input.status !== "discontinued" && input.active !== false` |
| Import scripts | Typically `active: true` on upsert |
| `export-shopify-csv.ts` | `Published` / `Status` derived from `active` |

#### Admin UI

- **List:** shows `status` text (`web/app/admin/inventory/products/page.tsx`)
- **Detail API:** PATCH supports `presell`, `pricing`, `shipping` only — **no UI or API to toggle `active` or `status` on existing products** (except via `POST` upsert with full payload)

**Conclusion:** `active === true` currently means **“included in public catalog queries and allowed for new checkout”** — effectively **on the selling surface**, not merely “exists in database.”

**Live snapshot (05A):** 661 `active`, 7 `inactive` — almost the entire catalogue is treated as sellable assortment today.

---

### Existing `status` Field

| Value (in code) | Meaning in practice |
|-----------------|---------------------|
| `active` | Default on upsert; shown in admin list |
| `draft` | Typed in `ProductStatus`; **minimal storefront use** |
| `discontinued` | `upsertProduct` forces `active: false`; Joybuy mapper treats as not active |

| Aspect | Finding |
|--------|---------|
| DB constraint | **None** — any text allowed |
| Index | `products_status_idx` on `status` |
| Storefront filter | **Does not filter on `status` directly** (only via `active` coupling in upsert) |
| User-facing | Indirect — inactive/discontinued products hidden from catalog |

**Joybuy / scripts** also check `status !== "discontinued"` alongside `active`.

---

### Inventory vs Assortment

These must remain **separate concepts**:

| Layer | Fields / logic | Example |
|-------|----------------|---------|
| **Assortment / lifecycle** | `active`, `status` (today) | Product is in current selling catalogue |
| **Inventory availability** | `stock`, presell fields, `getSellableStock()` | Product is out of stock but still in assortment |

**Valid states:**

- ACTIVE assortment + OUT OF STOCK → still assortment; may show sold out  
- ACTIVE assortment + PRESALE → still assortment; pre-order UX  
- PAUSED assortment + stock > 0 → should **not** appear on storefront (future model)  
- RETIRED + historical orders → row retained; no new sales  

**Do not** auto-pause products solely because `getSellableStock() === 0`.

---

### Order / Historical Data Safety

| Concern | Finding |
|---------|---------|
| `order_items.product_id` | FK to `products(id)` — **retain product rows** for referential integrity |
| Line item snapshot | `order_items` stores `product_id`, `quantity`, `price`, `presell_quantity` — **not** product name at insert |
| Order display | Admin joins / fetches product for display — works if product row exists (active or not) |
| Stock movements | Ledger references `product_id` — historical |
| PO lines | May reference `product_id` + `sku` (`0008_purchasing.sql`) |
| Changing assortment | **Safe** if products are **not deleted** — only gated from new catalog/checkout |
| Checkout on retired product | Correctly blocked when `active === false` |

**Critical rule:** Never delete products to remove from assortment. Use lifecycle flags only.

---

### Admin Workflow (current)

```
Import / upsert (scripts or POST /api/inventory/products)
        ↓
products row (active, status, stock, presell, pricing)
        ↓
Admin inventory list (all org products, status label)
        ↓
Product detail: presell / pricing / shipping PATCH only
```

**Missing today:**

- Explicit “pause selling” / “retire from assortment” control in admin UI  
- Bulk assortment review workflow  
- Reason / audit trail for assortment decisions  

Staff can upsert via API with `status: "discontinued"` to deactivate, but there is no dedicated lifecycle workflow.

---

### Storefront Filtering (current)

| Surface | Filters applied |
|---------|-----------------|
| Home / Chloe Edit | Empty (`products={[]}`) — no catalog query |
| Brand pages | `active === true` + org + brand match |
| `GET /api/catalog` | `active === true` + org |
| PDP `/products/[slug]` | `active === true` + org |
| Client cart | No server filter; localStorage holds `Product` snapshots |
| Checkout `POST /api/orders` | `active === true` + `getSellableStock()` |
| Search | No dedicated product search route found |

**`status` is not queried** on storefront paths — only `active` (and sellable at checkout).

---

### Target Lifecycle Model

Business target (conceptual):

| State | Meaning |
|-------|---------|
| **ACTIVE** | Part of current Chosen by Chloe selling assortment; may appear on storefronts |
| **PAUSED** | Retained in DB; temporarily not in selling assortment |
| **RETIRED** | Historical; no longer offered for sale |

This maps to **assortment**, not inventory.

---

### Architecture Options

| Option | Description |
|--------|-------------|
| **A** | Use `active` boolean only |
| **B** | New `assortment_status` (`active` \| `paused` \| `retired`) |
| **C** | Repurpose / extend `status` |
| **D** | Composite: `status` + `active` with documented matrix |

#### Decision table

| Option | Pros | Cons | Risk | Recommendation |
|--------|------|------|------|----------------|
| **A: `active`** | No migration; already gates storefront | Binary only; cannot distinguish PAUSED vs RETIRED; overloaded meaning; 661/668 already “active” | High — cannot express business model | **Not sufficient** |
| **B: `assortment_status`** | Clear business vocabulary; separates assortment from inventory; extensible | Requires migration + query updates + admin UI (later) | Medium — phased rollout needed | **Recommended** |
| **C: `status`** | Field exists | `draft`/`discontinued` semantics don’t match PAUSED/RETIRED; loose DB typing; Joybuy/scripts already use `discontinued` | High — breaking semantic drift | **Not recommended as sole model** |
| **D: Matrix** | Reuses both fields | Confusing dual flags; admin burden; hard to explain | Medium | **Not recommended** |

---

### Recommended Architecture

**Recommendation: Option B — dedicated `assortment_status`**

Keep existing fields for backward compatibility during transition:

| Layer | Field(s) | Role |
|-------|----------|------|
| **Assortment** | `assortment_status` (new) | `active` \| `paused` \| `retired` — **selling catalogue** |
| **Inventory master** | `status` (existing) | Operational master data: `active` \| `draft` \| `discontinued` |
| **Legacy gate** | `active` (existing) | Transitional storefront gate until queries migrate |

**Target storefront rule (future, after approval):**

```
assortment_status = 'active'
        ↓
storefront eligibility
(and optionally still require active = true during transition)
```

**Do not implement filtering until lifecycle is approved and backfill strategy agreed.**

**Separate inventory:** Continue using `getSellableStock()` for sellability — independent of `assortment_status`.

---

### Migration Proposal

**NOT EXECUTED in Sprint 05B.** For explicit approval in a future sprint.

```sql
-- PROPOSAL ONLY — do not run without approval

alter table public.products
  add column if not exists assortment_status text
    check (assortment_status in ('active', 'paused', 'retired'));

comment on column public.products.assortment_status is
  'Chosen by Chloe selling assortment: active | paused | retired. Distinct from inventory availability.';

create index if not exists products_assortment_status_idx
  on public.products (assortment_status);

-- Optional future audit support (separate proposal):
-- assortment_status_reason text null
-- assortment_status_updated_at timestamptz
-- assortment_status_updated_by uuid references auth.users(id)
```

| Property | Proposal |
|----------|----------|
| Field name | `assortment_status` |
| Type | `text` with CHECK |
| Allowed values | `active`, `paused`, `retired` |
| Default | **No automatic default to `active`** for all 668 rows — see mapping workflow |
| Nullability | `NULL` allowed initially → “not yet reviewed” |
| Index | On `assortment_status` for storefront queries |
| Rollback | `DROP COLUMN assortment_status`; revert query changes |

**Phased rollout:**

1. Add nullable column (no storefront change)  
2. Admin assortment review UI / bulk tools  
3. Business owner sets `active` / `paused` / `retired` per product  
4. Update storefront queries: `assortment_status = 'active'`  
5. Deprecate reliance on `active` boolean for assortment (or sync: `active = assortment_status = 'active'`)

---

### Existing Data Mapping (proposal — NOT applied)

**Do not bulk-apply.** Business owner must confirm each assortment decision.

| Current `active` | Current `status` | Proposed `assortment_status` | Confidence | Notes |
|------------------|------------------|------------------------------|------------|-------|
| `false` | any | `retired` | Medium | 7 inactive rows — likely intentional delist |
| `true` | `discontinued` | `retired` | High | Already coupled to `active: false` in upsert |
| `true` | `draft` | `paused` | Low | Rare; confirm case-by-case |
| `true` | `active` | **Requires human review** | Low | **661 rows — NOT auto-active assortment** |

**Important:** Mapping all 661 `active=true` products to `assortment_status = 'active'` would **repeat the current problem** (everything sellable). The correct default for unreviewed historical imports is **`paused` or `NULL`** until explicitly promoted to `active` by the business owner.

Suggested review starting point (data quality, not selection):

- 623 catalogue-ready candidates → **input set for review**, not output assortment  
- 23 missing images → fix or exclude from promotion to `active`  
- 17 zero sellable → may remain `paused` while stock inbound  

---

### Assortment Review Workflow (future)

```
ALL PRODUCTS (668 historical)
        ↓
DATA QUALITY FILTER (05A readiness — objective)
        ↓
ASSORTMENT REVIEW (human — ACTIVE / PAUSED / RETIRED)
        ↓
ACTIVE ASSORTMENT (assortment_status = active)
        ↓
MERCHANDISING (future — ranking, collections)
        ↓
THE CHLOE EDIT (future — editorial subset)
```

**No automated promotion.** System surfaces candidates; human decides.

---

### Audit Trail Considerations

**Current state:** No product lifecycle audit log. `updated_at` on products changes on pricing/presell/shipping edits only.

**Useful future fields (optional):**

- `assortment_status_reason` (text)  
- `assortment_status_updated_at`  
- `assortment_status_updated_by` (staff user)  

Or a small `product_assortment_events` table for history.

**Recommendation:** Add reason + timestamp when assortment UI is built — supports accountability without blocking Sprint 05B design.

---

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Treating all `active=true` as assortment | **Critical** | New `assortment_status`; human review |
| Deleting products to delist | **Critical** | Policy: never delete; use retired |
| Conflating out-of-stock with paused | High | Separate inventory from assortment |
| Breaking historical orders | High | Retain rows; FK on `order_items` |
| Dual `active` + `assortment_status` drift | Medium | Transitional sync rule or phased cutover |
| No admin UI for lifecycle | Medium | Future sprint before storefront cutover |
| 623 candidates mistaken for keep list | High | Label as catalogue-ready, not Chosen |

---

### Recommended Next Steps

1. **Approve** `assortment_status` architecture (this document).  
2. **Future sprint:** apply migration (nullable column, no default mass-active).  
3. **Build admin assortment controls** (per-product + bulk review; reason optional).  
4. **Business owner review** — promote products to `active` assortment explicitly.  
5. **Update storefront queries** to filter `assortment_status = 'active'`.  
6. **Then** merchandising (04C+) and Chloe Edit population — not before assortment layer exists.

---

### Answer: Cleanest way for the business owner to decide assortment

**Without deleting historical data:**

1. Introduce **`assortment_status`** (`active` | `paused` | `retired`) distinct from stock/presell.  
2. Keep all 668 rows in `products`.  
3. Provide an **admin assortment review** workflow (filter by brand, readiness, stock — using 05A intelligence).  
4. Business owner explicitly sets each product (or bulk sets with confirmation) to ACTIVE, PAUSED, or RETIRED with optional reason.  
5. Storefront only surfaces `assortment_status = 'active'` (plus existing inventory rules at checkout).  

**Do not** use `active=true` alone as the long-term assortment model — it already exposes ~99% of the database as sellable.

---

### Confirmation

- [x] No `INSERT` / `UPDATE` / `DELETE` on `public.products`  
- [x] No storefront Shell V1 changes  
- [x] No Chloe Edit population  
- [x] No Shopify / Joybuy integration changes  
- [x] No product selection or ranking recommendations  

---

### Related documentation

- [`catalogue-intelligence-05a.md`](catalogue-intelligence-05a.md) — readiness metrics  
- [`thomas-os-catalogue-audit-04a.md`](thomas-os-catalogue-audit-04a.md) — catalogue architecture  
- [`product-identity-and-pdp-04b.md`](product-identity-and-pdp-04b.md) — PDP / slug layer  
