# Database Schema — Inventory Module

## Product Master (`products` — extended)

| Column | Type | Notes |
|--------|------|-------|
| sku | text | Unique |
| name | text | |
| brand | text | |
| category | text | |
| description | text | |
| barcode | text | EAN-13 |
| weight_grams | integer | |
| length_mm, width_mm, height_mm | integer | |
| country_of_origin | text | |
| hs_code | text | |
| cost_price | numeric | For valuation |
| wholesale_price | numeric | |
| retail_price | numeric | Customer price |
| currency | text | Default CNY |
| status | text | active / draft / discontinued |
| image_url | text | Primary image |
| gallery_images | jsonb | Array of URLs |
| tags | text[] | |
| low_stock_threshold | integer | Alert trigger |
| stock | integer | Denormalized total (synced) |

## Warehouses

- `warehouses` — id, code, name, address, is_default
- `warehouse_locations` — id, warehouse_id, code, name

## Inventory

- `inventory_balances` — per product × location buckets
- `stock_movements` — immutable ledger

## Receiving & Stock Take

- `goods_receipts` + `goods_receipt_lines`
- `stock_take_sessions` + `stock_take_lines`

## Alerts

- `inventory_alerts` — generated on dashboard load

## Migration

Run `0006_inventory_warehouse.sql` in Supabase SQL Editor.

Seeds:
- London Garage (A01, A02, A03) — default
- Main Warehouse (R01, R02, R03)
- Opening balance migration for existing stock
