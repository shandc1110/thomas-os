# Sprint 006 — Inventory & Warehouse Management

## Stories Delivered

| # | Story | Status |
|---|-------|--------|
| 1 | Product Master | ✅ Extended `products` table |
| 2 | Inventory balances | ✅ `inventory_balances` table |
| 3 | Warehouse locations | ✅ Warehouses + locations, seeded |
| 4 | Stock movement ledger | ✅ Immutable `stock_movements` |
| 5 | Goods receiving | ✅ `/admin/inventory/receive` |
| 6 | Barcode support | ✅ EAN, QR, Code128 generation |
| 7 | Stock take | ✅ Sessions + variance + approval |
| 8 | Inventory dashboard | ✅ `/admin/inventory` |
| 9 | Alerts | ✅ Low stock, out of stock, negative |
| 10 | Product images | ✅ Primary + gallery_images field |
| 11 | Stock ledger | ✅ Per-product ledger on detail page |

## URLs

- Dashboard: `/admin/inventory`
- Products: `/admin/inventory/products`
- Warehouses: `/admin/inventory/warehouse`
- Receive goods: `/admin/inventory/receive`
- Stock take: `/admin/inventory/stock-take`

## Testing Checklist

- [ ] Run migration `0006_inventory_warehouse.sql`
- [ ] Open dashboard — stats load
- [ ] View products list — search, select all, export CSV
- [ ] Open product detail — ledger, balances, barcode
- [ ] Receive goods — stock increases, movement logged
- [ ] Place customer order — `customer_order` movement created
- [ ] Start stock take — count product — approve — adjustment movement
- [ ] Verify alerts appear for low/out-of-stock products
- [ ] Search product by barcode via API
