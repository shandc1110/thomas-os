# ADR-002: Inventory Ledger Architecture

## Status

Accepted — Sprint 006

## Context

Inventory was previously a single `products.stock` integer updated via compare-and-swap at checkout. This does not support warehouses, audit trails, or multi-channel sync.

## Decision

Implement an **immutable stock movement ledger** with materialized `inventory_balances` updated transactionally when movements are created.

## Consequences

- Full audit trail for every stock change
- Multi-warehouse support
- `products.stock` remains as a denormalized sum for storefront backward compatibility
- Customer orders create `customer_order` movements
- Goods receiving creates `goods_received` movements
- Stock take creates `stock_take` adjustment movements

## Alternatives Considered

- Direct balance editing — rejected (no audit trail)
- Compute balances on-the-fly from all movements — rejected for dashboard performance at scale
