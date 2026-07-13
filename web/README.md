# Chosen by Chloe — Order Portal

A mobile-first ordering and fulfilment portal built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4**, and **Supabase**.

Customers browse active products, add them to a cart, and check out. Orders are written to Supabase with atomic stock reduction. Staff use the fulfilment dashboard to generate packing slips and push orders to Shopify for shipping label purchase.

## Tech stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Storage)
- @react-pdf/renderer (server-side packing slip PDFs)
- Shopify Admin GraphQL API (draft order creation)

## Prerequisites

- Node.js 20+ (LTS recommended)
- A Supabase project with `products`, `orders`, and `order_items` tables
- A Shopify store with Admin API access (for fulfilment sync)

## Getting started (including on a new machine)

1. **Clone and install**

   ```bash
   git clone https://github.com/shandc1110/chosen-by-chloe-order-portal.git
   cd chosen-by-chloe-order-portal/web
   npm install
   ```

2. **Configure environment variables**

   Copy the example file and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key (public) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret** server key — required for orders, admin APIs, and scripts |
   | `RESEND_API_KEY` | Order confirmation emails (optional) |
   | `ORDER_EMAIL_FROM` | Sender address for confirmation emails |
   | `ORDER_EMAIL_CC` | CC on every order confirmation |
   | `SHOPIFY_STORE` | Shopify store subdomain (e.g. `chosenbychloe`) |
   | `SHOPIFY_ADMIN_TOKEN` | Admin API access token with `write_draft_orders` scope |
   | `SHOPIFY_API_VERSION` | GraphQL API version (defaults to `2025-01`) |

   Get the `service_role` key from Supabase → Project Settings → API.

3. **Apply database migrations**

   Run all SQL files in `supabase/migrations/` against your Supabase database (in order). The latest migration (`0004_fulfilment_fields.sql`) adds product weights and fulfilment tracking.

   ```bash
   npx tsx scripts/apply-migration.ts supabase/migrations/0004_fulfilment_fields.sql
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   - Shop: [http://localhost:3000](http://localhost:3000)
   - Fulfilment dashboard: [http://localhost:3000/admin/orders](http://localhost:3000/admin/orders)

## Fulfilment workflow

```
Customer places order
        ↓
Order appears in /admin/orders
        ↓
Download Packing Slip (PDF)
        ↓
Push to Shopify (Draft Order created)
        ↓
Open Shopify → purchase shipping label
        ↓
Dispatch parcel
```

No manual retyping of customer details is required.

## Inventory & warehouse (Sprint 006)

The inventory module is the single source of truth for all physical stock.

- **Dashboard:** [http://localhost:3000/admin/inventory](http://localhost:3000/admin/inventory)
- **Products:** `/admin/inventory/products` — search, export CSV, stock ledger
- **Warehouses:** `/admin/inventory/warehouse` — London Garage, Main Warehouse
- **Receive goods:** `/admin/inventory/receive` — inbound stock with PO reference
- **Stock take:** `/admin/inventory/stock-take` — cycle counts with variance approval

Run migration `0006_inventory_warehouse.sql` before using inventory features.

Architecture docs: `../docs/vision/ARCHITECTURE.md` and `../docs/database/Schema.md`.

## Shopify setup

1. In **Shopify Admin → Settings → Apps and sales channels → Develop apps**, create a custom app.
2. Configure **Admin API scopes**:
   - `read_draft_orders`
   - `write_draft_orders`
3. Install the app and copy the **Admin API access token**.
4. Add to `.env.local`:
   ```
   SHOPIFY_STORE=your-store-name
   SHOPIFY_ADMIN_TOKEN=shpat_...
   SHOPIFY_API_VERSION=2025-01
   ```

### How Shopify sync works

- Each portal order is tagged in Shopify as `portal:CBC9001` (using the portal order number).
- Before creating a draft order, the system searches Shopify for this tag to prevent duplicates.
- The draft order includes customer name, shipping address, phone, line items (SKU, quantity, weight), currency, notes, WeChat ID, and parcel weight.
- After a successful push, `shopify_draft_order_id` and `fulfilment_status = ready` are saved in Supabase.

## Product weights

Shipping labels require parcel weight. Each product should have `weight_grams` set in Supabase:

```sql
UPDATE products SET weight_grams = 240 WHERE sku = 'ABC001';
```

Order weight is computed as `SUM(weight_grams × quantity)` and stored as `orders.total_weight_grams`. Displayed as e.g. `1.84 kg` in the fulfilment dashboard.

## Database migrations

| File | Change |
| --- | --- |
| `0001_orders_notes.sql` | `orders.notes` |
| `0002_orders_checkout_fields.sql` | `email`, `address`, `payment_method`, `currency` |
| `0003_orders_order_number.sql` | `order_number` (unique, e.g. CBC9001) |
| `0004_fulfilment_fields.sql` | `products.weight_grams`, `orders.total_weight_grams`, `orders.shopify_draft_order_id`, `orders.fulfilment_status` |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint |
| `npm run import:products` | Import products from `../CI+PL.xlsx` |
| `npm run upload:images` | Upload product images to Supabase Storage |

### Adding product images

Name each image file after the product SKU (e.g. `MID-001.jpg`), place them in `web/product-images/`, then run:

```bash
npm run upload:images
```

## Project structure

```
web/
  app/
    page.tsx                          # Homepage: product grid
    checkout/page.tsx                 # Checkout form + order summary
    admin/orders/page.tsx             # Fulfilment dashboard
    admin/orders/[id]/page.tsx        # Order detail + fulfilment actions
    api/orders/route.ts               # POST: create order
    api/orders/list/route.ts          # GET: list orders (admin)
    api/orders/[id]/route.ts          # GET: order detail
    api/orders/[id]/packing-slip/     # GET: download PDF
    api/orders/[id]/shopify/          # POST: push to Shopify
  components/
    pdf/PackingSlip.tsx               # @react-pdf packing slip template
  hooks/
    useShopify.ts                     # Shopify push + PDF download hooks
  lib/
    pdf/packingSlip.ts                # Server-side PDF generation
    shopify/                          # GraphQL client, search, create draft order
    orders.ts                         # Order queries + packing slip data builder
    weight.ts                         # Weight calculation + formatting
  types/
    order.ts                          # Order + fulfilment types
    shopify.ts                        # Shopify API types
  supabase/migrations/                # Incremental schema changes
```

## Manual testing checklist

### Packing slip

- [ ] Place a test order through the shop checkout
- [ ] Open `/admin/orders` and confirm the order appears
- [ ] Open the order detail page
- [ ] Click **Download Packing Slip** — PDF downloads immediately
- [ ] Open PDF: verify logo, order number, customer name, address, phone, WeChat ID, payment method, currency, item table, quantities, subtotal, grand total, footer
- [ ] Print PDF on A4 — layout fits correctly

### Product weights

- [ ] Set `weight_grams` on test products in Supabase
- [ ] Place an order with multiple items
- [ ] Confirm parcel weight displays correctly on order detail (e.g. `1.84 kg`)
- [ ] Confirm weight appears on packing slip PDF

### Shopify sync

- [ ] Configure `SHOPIFY_STORE`, `SHOPIFY_ADMIN_TOKEN` in `.env.local`
- [ ] Click **Push to Shopify** on an order
- [ ] Confirm draft order created in Shopify Admin → Orders → Drafts
- [ ] Verify customer name, address, phone, line items, SKU, quantity, weight, currency, notes, WeChat ID
- [ ] Click **Push to Shopify** again — confirm "Already Synced" (no duplicate)
- [ ] Click **Open Shopify** — opens the draft order in Shopify Admin
- [ ] Confirm `shopify_draft_order_id` saved in Supabase and status shows **Ready**

### Fulfilment dashboard

- [ ] `/admin/orders` shows columns: Order, Packing Slip, Shopify, Weight, Status
- [ ] Status shows **Ready** after Shopify sync
- [ ] Buttons show loading states while processing
- [ ] Error messages display on failure (e.g. missing Shopify credentials)
