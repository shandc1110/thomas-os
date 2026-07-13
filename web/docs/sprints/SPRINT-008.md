# Sprint 008 — Purchasing & Supplier Management

## Overview

Central procurement platform: suppliers, brands, purchase orders, goods receiving, shipments, and procurement dashboard.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/purchasing` | Procurement dashboard |
| `/admin/purchasing/suppliers` | Supplier master CRUD |
| `/admin/purchasing/brands` | Brand management |
| `/admin/purchasing/purchase-orders` | PO list + create |
| `/admin/purchasing/purchase-orders/[id]` | PO detail, status advance, receive goods |
| `/admin/purchasing/shipments` | Inbound shipment tracking |

## APIs

`GET|POST /api/purchasing` with `resource` param:

- `dashboard`, `suppliers`, `brands`, `purchase-orders`, `purchase-order`, `shipments`
- POST: `supplier`, `brand`, `purchase-order`, `po-status`, `receive-po`, `shipment`

## Migration

Run `supabase/migrations/0008_purchasing.sql` in Supabase SQL Editor.

## Receiving Flow

PO receive → `receivePurchaseOrder()` → `receiveGoods()` → inventory ledger + landed cost update.

## Test Checklist

- [ ] Create supplier with contact details
- [ ] Create brand linked to supplier
- [ ] Create PO with line items
- [ ] Advance PO status through lifecycle
- [ ] Receive partial delivery into warehouse
- [ ] Verify inventory balances increase
- [ ] Track inbound shipment with ETA
- [ ] Dashboard shows spend by supplier

## Future (Sprint 009)

Schema supports treasury integration: forward contracts, FX exposure, supplier payments — not implemented yet.
