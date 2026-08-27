# Assortment Admin UI
## Sprint 05D

### Purpose

Sprint 05D adds an internal admin tool for the business owner to review and classify products into the Chosen by Chloe selling assortment. The decision is stored in `public.products.assortment_status`. The storefront does **not** consume this field yet — classification happens before a future storefront activation sprint.

### Status Model

| UI label       | Database value |
|----------------|----------------|
| Not reviewed   | `NULL`         |
| Active         | `active`       |
| Paused         | `paused`       |
| Retired        | `retired`      |

- **Active** — intentionally part of the current selling assortment.
- **Paused** — temporarily not part of the selling assortment.
- **Retired** — no longer offered for sale; remains for history.
- **Not reviewed** — no business decision yet (all 668 products start here after migration 0014).

`NULL` is never shown in the UI as “NULL”.

### Admin Location

- **List:** `/admin/inventory/assortment` (Inventory nav → Assortment)
- **Detail:** Assortment panel on `/admin/inventory/products/[id]`

Uses the existing Thomas OS admin shell and `AdminNav`.

### Filters

- Assortment status: All, Not reviewed, Active, Paused, Retired (with live counts)
- Brand
- Category
- Technical active: all / active / inactive (`products.active`)
- Stock: all / in stock / out of stock / presell (via `getSellableStock()`)

Default filter: **Not reviewed** (review queue).

### Search

Server-side search on product name, SKU, and brand.

### Bulk Actions

Select multiple rows → Set Active / Set Paused / Set Retired → confirmation dialog → explicit confirm.

Bulk updates only `assortment_status`.

### Security

- Read/write API: `GET` and `PATCH` `/api/inventory/assortment`
- Wrapped with `staffRoute` → `requireStaff()` + Supabase admin client
- Storefront visitors cannot call these endpoints

### Update Semantics

Single save (per row or product detail) and bulk save call `PATCH /api/inventory/assortment`.

Server-side validation accepts only `active`, `paused`, or `retired`.

Updates execute:

```sql
UPDATE public.products
SET assortment_status = $1, updated_at = now()
WHERE id = $id AND organization_id = $org
```

**Does not modify:** `active`, `status`, `stock`, `presell_*`, `price`, SKU, brand, category, images, or any other column.

### Order Safety

Assortment changes do not touch `order_items` or historical order references. Products are never deleted.

### Inventory Separation

Stock display uses `getSellableStock()`. Changing assortment status does not change inventory fields. A product can be Active + out of stock, or Paused + in stock.

### Storefront Separation

Storefront catalog, PDP, checkout, and `fetchCatalogProducts` continue to gate on `products.active` only. **No** filter on `assortment_status` was added in 05D.

### Audit Trail Future Work

Update functions (`updateProductAssortmentStatus`, `bulkUpdateAssortmentStatus`) are isolated in `web/lib/inventory/assortment.ts` so a future sprint can log `{ product_id, from, to, staff_id, timestamp }` without refactoring the UI.

### Testing

`web/lib/inventory/__tests__/assortment.test.ts` covers:

- Label mapping (NULL → Not reviewed)
- Status display labels
- Invalid status rejection
- Single update payload (only `assortment_status` + `updated_at`)
- Bulk update payload
- Count aggregation

API authorization is enforced by `staffRoute` (same pattern as other inventory admin APIs).

### Next Sprint

After sufficient catalogue classification:

1. Gate storefront eligibility on `assortment_status = 'active'`
2. Populate Chloe Edit / merchandising from active assortment
3. Optional `assortment_reason` field and audit log
