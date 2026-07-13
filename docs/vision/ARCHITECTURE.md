# Architecture

## Stack

- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS v4
- **Backend:** Next.js API routes (Node.js runtime)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (product images)
- **Integrations:** Shopify Admin GraphQL, Resend (email)

## Inventory Architecture

```
Customer Order / Goods Receipt / Stock Take
              ↓
      createStockMovement()  ← immutable ledger
              ↓
    inventory_balances       ← updated transactionally
              ↓
    products.stock           ← synced for storefront
```

**Rule:** Never edit `inventory_balances` or `products.stock` directly. All changes go through `lib/inventory/movements.ts`.

## Key Tables

| Table | Purpose |
|-------|---------|
| `products` | Product Master (canonical SKU record) |
| `warehouses` | Warehouse definitions |
| `warehouse_locations` | Bins/shelves within warehouses |
| `inventory_balances` | Current stock per product × location |
| `stock_movements` | Immutable audit ledger |
| `goods_receipts` | Inbound receiving (future PO link) |
| `stock_take_sessions` | Cycle count sessions |
| `inventory_alerts` | Low stock, negative stock, etc. |

## Folder Structure

```
web/
  app/admin/inventory/     # Inventory UI
  app/api/inventory/       # Inventory APIs
  lib/inventory/           # Business logic
  lib/warehouse/           # Warehouse services
  lib/barcode/             # Barcode generation
  types/                   # TypeScript types
  hooks/                   # React hooks
  supabase/migrations/     # Schema migrations
```
