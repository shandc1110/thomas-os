# Sprint 007 — Warehouse Operations

## Overview

Production warehouse module for pick → pack → dispatch workflows, integrated with inventory, orders, packing slips, and shipping.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/warehouse` | Mobile-first dashboard with KPIs |
| `/admin/warehouse/picking/[orderId]` | Pick list by shelf location + barcode scan |
| `/admin/warehouse/packing/[orderId]` | Item verification, packing slip, label |
| `/admin/warehouse/dispatch/[orderId]` | Confirm dispatch with tracking |

## APIs

- `GET /api/warehouse/dashboard` — stats + orders awaiting fulfilment
- `GET|POST /api/warehouse/picking` — generate, start, confirm_line, complete
- `GET|POST /api/warehouse/packing` — start, verify, slip_printed, label_printed, complete, dispatch
- `GET /api/warehouse/labels?type=product|shelf|location&value=...` — barcode label SVG

## Migration

Run `supabase/migrations/0007_warehouse_operations.sql` in Supabase SQL Editor.

Adds `warehouse_status`, pick lists, pack sessions, verifications, and event log.

## Warehouse Statuses

`pending` → `picking` → `picked` → `packing` → `packed` → `awaiting_label` → `ready_to_ship` → `shipped` → `delivered`

## Test Checklist

- [ ] Dashboard shows order counts and performance KPIs
- [ ] Generate pick list grouped by location (A01, A02…)
- [ ] Scan SKU confirms pick line
- [ ] Complete picking moves order to packing
- [ ] Pack verification shows green/red for match/mismatch
- [ ] Download packing slip PDF
- [ ] Complete packing → ready to ship
- [ ] Dispatch with optional tracking number
- [ ] Mobile UI usable on phone (large touch targets)
