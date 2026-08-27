# Assortment Status Migration

## Sprint 05C

**Status:** Schema implemented — **migration not applied to production**  
**Principle:** Build the system to decide assortment later; existing products remain `NULL` (not yet reviewed).

---

### Objective

Add `public.products.assortment_status` to represent **commercial selling assortment** separately from:

- `products.active` (existing technical/public gate)
- `products.status` (inventory master lifecycle)
- Inventory / `getSellableStock()`

No automatic promotion of existing products. No storefront filtering changes.

---

### Schema Change

```sql
alter table public.products
  add column if not exists assortment_status text;
```

| Property | Value |
|----------|--------|
| Table | `public.products` |
| Column | `assortment_status` |
| Type | `text` |
| Nullable | **Yes** |
| Default | **None** |

---

### Allowed Values

When non-null, only:

| Value | Meaning |
|-------|---------|
| `active` | In current Chosen by Chloe selling assortment |
| `paused` | Temporarily not in selling assortment |
| `retired` | Historical; no longer offered for sale |

Enforced by CHECK constraint `products_assortment_status_check`.

---

### NULL Semantics

`assortment_status IS NULL` means **not yet reviewed**.

- Not a permanent fourth business state in application logic
- All existing rows remain `NULL` after migration apply
- New products remain `NULL` until explicitly classified (Sprint 05D admin)

---

### Existing Data

**No `UPDATE` statements in migration.**

After apply, all existing rows have `assortment_status = NULL` until the business owner reviews them.

---

### Relationship to `active`

| Field | Role (unchanged) |
|-------|------------------|
| `active` | Existing storefront/checkout gate |
| `assortment_status` | Future commercial assortment layer |

Storefront still filters on `active` only. `assortment_status` is **not** a storefront requirement in 05C.

---

### Relationship to `status`

`products.status` (`active` | `draft` | `discontinued`) unchanged.

Do not merge `status` into `assortment_status`.

---

### Relationship to Inventory

Independent. Valid future state:

```
assortment_status = 'active' AND stock = 0
```

`getSellableStock()` unchanged.

---

### Order Safety

No changes to `orders`, `order_items`, or product FKs. No product deletes.

---

### Index

**Name:** `products_assortment_status_idx`

**Type:** B-tree **partial** index

```sql
create index if not exists products_assortment_status_idx
  on public.products (assortment_status)
  where assortment_status is not null;
```

**Rationale:** Future queries filter classified products (`active` / `paused` / `retired`). Rows with `NULL` (not reviewed) are excluded from the index — smaller index, matches expected admin/review workflows. Full-table scans for “unreviewed” queries remain possible when needed.

---

### Constraint

**Name:** `products_assortment_status_check`

```sql
check (
  assortment_status is null
  or assortment_status in ('active', 'paused', 'retired')
)
```

Invalid values (e.g. `'draft'`, `'unknown'`) are rejected by the database.

---

### TypeScript Changes

| File | Change |
|------|--------|
| `web/lib/types.ts` | `AssortmentStatus` type; `Product.assortment_status` |
| `web/types/inventory.ts` | `ProductMaster.assortment_status` |
| `web/lib/products/map-product.ts` | Maps column; defaults to `null` |
| `web/lib/inventory/products.ts` | `mapProductRow` includes field |

**No storefront logic** depends on `assortment_status` yet.

No generated Supabase types in repo — manual types only.

---

### Migration File

`web/supabase/migrations/0014_assortment_status.sql`

Apply manually (same as other migrations):

```bash
cd web
npx tsx scripts/apply-migration.ts supabase/migrations/0014_assortment_status.sql
```

**Do not apply to production without explicit approval.**

---

### Rollback

Run in Supabase SQL Editor (order matters):

```sql
drop index if exists public.products_assortment_status_idx;
alter table public.products drop constraint if exists products_assortment_status_check;
alter table public.products drop column if exists assortment_status;
```

Does not affect `active`, `status`, orders, inventory, or pricing.

---

### Deployment Checklist

- [ ] Review migration SQL in staging
- [ ] Apply `0014_assortment_status.sql` on target database
- [ ] Verify column exists: `SELECT assortment_status FROM products LIMIT 1;` → all `NULL`
- [ ] Verify constraint rejects invalid value (staging only)
- [ ] **Do not** bulk `UPDATE` products to `active`
- [ ] Deploy application types (05C commit) — backward compatible until column exists
- [ ] Storefront behaviour unchanged until Sprint 05D+ assortment review + query updates

---

### Next Sprint — Admin Controls (05D)

- Admin UI to set `active` / `paused` / `retired`
- Bulk review workflow
- Optional reason / audit fields
- After business review: storefront filter `assortment_status = 'active'`

---

### Tests

`web/supabase/migrations/__tests__/0014-assortment-status.test.ts` validates migration SQL (no UPDATE, constraint, partial index).
