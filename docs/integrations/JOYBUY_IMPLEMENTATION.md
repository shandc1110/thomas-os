# Joybuy Open Platform — Implementation Notes

**Status:** Foundation only (Joybuy app **Pending Review**)  
**Source of truth:** Thomas OS (products, SKU, images, pricing, inventory, orders, fulfilment)  
**Role of Joybuy:** Sales channel — not a second catalogue

---

## 1. Architecture

```
Thomas OS (source of truth)
  ├── Products / SKU / Images / Pricing
  ├── Inventory (sellable stock via getSellableStock)
  ├── Orders + warehouse (pick → pack → dispatch)
  └── Shopify (existing fulfilment adapter)
        │
        ▼
  Joybuy Connector  (web/lib/integrations/joybuy/)
        │
        ▼
  Joybuy Open Platform  (API paths TBD after official docs)
```

Thomas remains authoritative. Joybuy receives mapped payloads; inbound Joybuy orders are adapted into existing Thomas orders and warehouse workflow.

### Code layout

| Path | Role |
|------|------|
| `web/lib/integrations/joybuy/` | Client stub, mappers, sync, logging |
| `web/lib/channels/` | Lightweight channel status model |
| `web/app/api/integrations/joybuy/` | Callback + staff sync/status routes |
| `web/app/admin/integrations/joybuy/` | Admin status UI |
| `web/supabase/migrations/0013_channel_connections.sql` | Channel connection rows (no secrets) |

Mirrors the thin Shopify adapter pattern (`web/lib/shopify/`) without inventing Joybuy HTTP contracts.

---

## 2. Current Thomas OS data model (relevant)

### Product (`web/lib/types.ts`)

`id`, `sku`, `name`, `brand`, `category`, `description`, `barcode`, `price`, `retail_price`, `shopify_price`, `cost_price`, `currency`, `image_url`, `gallery_images`, `stock`, `presell_*`, `expected_arrival_month`, `active`, `status`, `weight_grams`, dimensions, timestamps.

### Inventory

- On-hand: `products.stock` + warehouse ledger (`inventory_balances` / `stock_movements`)
- Sellable for channels: **`getSellableStock()`** in `web/lib/presell.ts` (on-hand + presell pool)
- Joybuy inventory payloads **must** reuse this helper — no second stock DB

### Orders

- Created via `POST /api/orders` (storefront / Stripe)
- Fulfilment: packing slip → Shopify draft order (manual) → pick/pack/dispatch
- Joybuy orders will import into the same `orders` / `order_items` tables and warehouse pipeline

### Existing channels

- Shopify: env credentials + `orders.shopify_draft_order_id`
- Stripe: payments
- **No prior `channel_connections` table** — added in migration 0013

---

## 3. Proposed Joybuy integration architecture

1. **Config** (`config.ts`) — server-only env; validates only when Joybuy is invoked; app boots without credentials.
2. **Auth / client** (`auth.ts`, `client.ts`) — typed interfaces; methods throw `JoybuyApiNotImplementedError` / `JoybuyNotConfiguredError` until official API docs are wired.
3. **Mappers** (`products.ts`, `inventory.ts`, `pricing.ts`, `orders.ts`, `fulfilment.ts`) — Thomas → channel-neutral payloads (not Joybuy field names).
4. **External ID map** (`mapping.ts` + DB table) — SKU ↔ Joybuy external ID for idempotent sync.
5. **Sync** (`sync.ts`) — orchestrates load → map → client; always returns typed failure while blocked.
6. **Orders inbound** — Joybuy order → Thomas order → warehouse → Joybuy shipment update (outbound).

---

## 4. Data mapping

### Product (Thomas → Joybuy payload)

| Thomas | JoybuyMappedProduct |
|--------|---------------------|
| sku | sku |
| name | title |
| brand | brand |
| category | category |
| description | description |
| barcode | barcode |
| price (channel sell price) | price |
| currency | currency |
| image_url | primaryImageUrl |
| gallery_images | galleryImageUrls |
| weight_grams / L×W×H | weightGrams / dimensionsMm |
| active / status | active |

Official Joybuy property names are **not** assumed; adapter layer will rename when docs are confirmed.

### Inventory

`buildJoybuyInventoryPayload(product)` → `{ sku, quantity: getSellableStock(product), onHand, presell, … }`

### Price

Uses catalog `price` (and currency). Does **not** send `cost_price` unless an official API later requires it.

### Orders (Joybuy → Thomas)

Typed stubs: `JoybuyOrder`, `JoybuyOrderLine`, `JoybuyAddress`, `JoybuyShipment`, `JoybuyOrderStatus`. Import adapters will create Thomas orders; fulfilment updates call Joybuy after dispatch.

---

## 5. Authentication approach

| Variable | Purpose |
|----------|---------|
| `JOYBUY_APP_KEY` | App key (after approval) |
| `JOYBUY_APP_SECRET` | App secret — **server only** |
| `JOYBUY_ACCESS_TOKEN` | Access token when issued |
| `JOYBUY_API_BASE_URL` | Official base URL when confirmed |
| `JOYBUY_CALLBACK_URL` | Optional registered callback |

- Never `NEXT_PUBLIC_*` for secrets
- Never commit secrets
- Signing / OAuth details **not implemented** until official Joybuy documentation is confirmed
- Prefer env for v1 secrets; DB `channel_connections.metadata` must not store AppSecret or tokens

---

## 6. Sync direction

| Domain | Direction | Notes |
|--------|-----------|--------|
| Products / images | Thomas → Joybuy | Idempotent via external ID map |
| Inventory | Thomas → Joybuy | Derived from sellable stock |
| Price | Thomas → Joybuy | Catalog sell price |
| Orders | Joybuy → Thomas | Then Thomas warehouse |
| Fulfilment / shipment | Thomas → Joybuy | After dispatch |

---

## 7. Security model

- All Joybuy client code is `server-only`
- Staff sync/status routes use `staffRoute` / `requireStaff`
- Callback route is public but **does not** store bodies, log secrets, or bypass auth into admin APIs
- Tenant scoping via `getOrganizationId()` / `getActiveTenant()`
- Structured logs omit secrets, auth codes, full addresses, payment details

---

## 8. Current limitations (Pending Review)

While the Joybuy Developer Console app **Thomas OS** is Pending Review:

- No AppKey / AppSecret available
- Official API base URL and schemas **not confirmed** in this codebase
- Client methods refuse live calls (`JOYBUY_NOT_CONFIGURED` / `JOYBUY_NOT_IMPLEMENTED`)
- Admin UI shows **Pending Review** / **Not configured** — actions do not fake success
- Channel status must not be `connected`

---

## 9. What remains blocked until Joybuy approval

See [JOYBUY_CHECKLIST.md](./JOYBUY_CHECKLIST.md). In particular: AppKey/Secret, API base URL, auth flow, product/SKU/media/inventory/price/order/fulfilment/webhook contracts, and production publish.

---

## 10. How to configure credentials later

1. Receive AppKey / AppSecret from Joybuy after approval.
2. Confirm official `JOYBUY_API_BASE_URL` from Joybuy docs (do not invent).
3. Set values in Vercel / `.env.local` (never commit).
4. Register callback: `https://<THOMAS_OS_DOMAIN>/api/integrations/joybuy/callback`
5. Implement signing/auth in `auth.ts` + HTTP in `client.ts` per official docs.
6. Apply migration `0013` if not already applied.
7. Run mapper unit tests; then a single test product sync in a sandbox if Joybuy provides one.

---

## 11. How to test safely

```bash
cd web
npm test
```

Tests cover mappers, config absence, and idempotency helpers — **no live Joybuy calls**.

Do not point production at Joybuy until checklist items for product/inventory/order are complete.

---

## 12. How to launch to production

1. Complete [JOYBUY_CHECKLIST.md](./JOYBUY_CHECKLIST.md).
2. Wire official API in the adapter layer only.
3. Sync a small product set; verify external ID mapping.
4. Inventory + price sync smoke test.
5. Import one test order → warehouse → shipment update.
6. Publish Joybuy application only when Joybuy Console allows and ops sign off.
