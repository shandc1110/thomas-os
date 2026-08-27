# Database Schema — Thomas OS

## Platform (migration 0009)

### `organizations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| slug | text | Unique tenant identifier |
| name | text | Display name |
| settings | jsonb | Tenant settings blob |

Seed: Chosen by Chloe (`00000000-0000-0000-0000-000000000001`).

### `staff_profiles`

Links Supabase Auth users to an organisation. Table exists; application enforcement planned Sprint 010.

| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK → auth.users |
| organization_id | uuid | FK → organizations |
| role | text | Default `admin` |

## Product Master (`products`)

| Column | Type | Notes |
|--------|------|-------|
| organization_id | uuid | FK → organizations (0009) |
| sku | text | Unique |
| name | text | |
| brand | text | |
| barcode | text | EAN-13 |
| cost_price, retail_price | numeric | Pricing |
| stock | integer | Denormalised total (synced from ledger) |
| low_stock_threshold | integer | Alert trigger |
| assortment_status | text nullable | `active` \| `paused` \| `retired`; NULL = not reviewed (`0014`) |

Full column list in migrations `0006_inventory_warehouse.sql` and `0014_assortment_status.sql`.

## Orders

| Column | Type | Notes |
|--------|------|-------|
| organization_id | uuid | FK → organizations (0009) |
| order_number | text | Tenant-prefixed (e.g. CBC-9001) |
| warehouse_status | text | Pick/pack/dispatch lifecycle |
| fulfilment_status | text | Shopify sync state |

## Warehouses

- `warehouses` — id, code, name, organization_id, is_default
- `warehouse_locations` — id, warehouse_id, code, name

## Inventory

- `inventory_balances` — per product × location buckets
- `stock_movements` — immutable ledger (ADR-002)

## Warehouse Operations (0007)

- `pick_lists`, `pick_list_lines`
- `pack_sessions`, `pack_verifications`
- `warehouse_events`

## Purchasing (0008)

- `suppliers`, `brands` — organization_id (0009)
- `purchase_orders`, `purchase_order_lines` — organization_id on POs
- `inbound_shipments` — **no organization_id yet** (tech debt TD-003)

## Receiving & Stock Take

- `goods_receipts` + `goods_receipt_lines`
- `stock_take_sessions` + `stock_take_lines`

## Migrations

Run in order in Supabase SQL Editor:

| File | Sprint | Purpose |
|------|--------|---------|
| `0001`–`0005` | 001–005 | Core commerce |
| `0006_inventory_warehouse.sql` | 006 | Product master, warehouses, ledger |
| `0007_warehouse_operations.sql` | 007 | Pick, pack, dispatch |
| `0008_purchasing.sql` | 008 | Suppliers, POs, shipments |
| `0009_platform_foundation.sql` | 008.5 | Organizations, staff, org FKs |

```bash
cd web
npx tsx scripts/apply-migration.ts supabase/migrations/0009_platform_foundation.sql
```

## Query Scoping

Sprint 009: list and dashboard queries filter by `organization_id` from `getOrganizationId()`. RLS policies are not yet enabled — access control is application-layer + service role.
