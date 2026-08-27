# Thomas OS

**Thomas** is a retail operating system. **Chosen by Chloe** is the first tenant.

A mobile-first platform built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4**, and **Supabase** — covering commerce, inventory, warehouse, procurement, and fulfilment.

Customers browse brand storefronts, add products to cart, and pay with **Stripe**. Staff use the Thomas admin console to manage orders, stock, warehouse operations, and purchasing.

## Tech stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Auth + Storage)
- Stripe Checkout (card payments)
- @react-pdf/renderer (packing slip PDFs)
- Shopify Admin GraphQL API (draft order fulfilment)
- Resend (order confirmation emails)

## Prerequisites

- Node.js 20+ (LTS recommended)
- A Supabase project with migrations applied (see below)
- Stripe account (Checkout + webhook)
- A Shopify store with Admin API access (for fulfilment sync)

## Getting started

1. **Clone and install**

   ```bash
   git clone https://github.com/shandc1110/thomas-os.git
   cd thomas-os/web
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Purpose |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key (public) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret** server key — orders, admin APIs, scripts |
   | `THOMAS_TENANT_SLUG` | Active tenant (default `chosen-by-chloe`) |
   | `RESEND_API_KEY` | Order confirmation emails (optional) |
   | `ORDER_EMAIL_FROM` | Sender address for confirmation emails |
   | `ORDER_EMAIL_CC` | CC on every order confirmation |
   | `SHOPIFY_STORE` | Shopify store subdomain (e.g. `chosenbychloe`) |
   | `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | Dev Dashboard app credentials (preferred) |
   | `SHOPIFY_ADMIN_TOKEN` | Legacy static Admin token (`shpat_…`) if not using client credentials |
   | `SHOPIFY_API_VERSION` | GraphQL API version (defaults to `2025-01`) |
   | `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` / `sk_live_…`) |
   | `STRIPE_WEBHOOK_SECRET` | Webhook signing secret for `checkout.session.completed` |
   | `NEXT_PUBLIC_SITE_URL` | Public site URL for Stripe redirects (production) |

3. **Apply database migrations**

   Run SQL files in `supabase/migrations/` **in order** (0001 → 0012):

   | Migration | Purpose |
   |-----------|---------|
   | 0001–0005 | Orders, checkout fields, fulfilment, customer fields |
   | 0006 | Inventory & warehouse ledger |
   | 0007 | Pick, pack, dispatch |
   | 0008 | Purchasing |
   | 0009 | Organizations & tenant scoping |
   | 0010 | Pre-sell / pre-order |
   | 0011 | Shopify price fields |
   | 0012 | Payments (Stripe) |

   ```bash
   npx tsx scripts/apply-migration.ts supabase/migrations/0012_payments.sql
   ```

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   | Surface | URL |
   |---------|-----|
   | Shop home | http://localhost:3000 |
   | Brands hub | http://localhost:3000/brands |
   | Brand page | http://localhost:3000/brands/mideer (also `/tonies`, `/micro-scooters`) |
   | Checkout | http://localhost:3000/checkout |
   | Admin | http://localhost:3000/admin |
   | Orders | http://localhost:3000/admin/orders |

## Storefront

- **Home** (`/`) — curated entry; brand navigation via `ShopHeader`
- **Brands** (`/brands`, `/brands/[slug]`) — registry-driven pages for Mideer, Tonies, Micro Scooters (Connetix / Le Toy Van reserved, inactive)
- **Catalog API** — `GET /api/catalog` (public) loads active products for the shop
- **Pre-order** — products with `presell_enabled` can sell against expected arrival (see migration 0010)
- **Checkout** — Stripe Checkout session; success/cancel pages under `/checkout/success` and `/checkout/cancel`
- **Currency** — brand-aware display (e.g. Mideer CNY, Tonies/Micro GBP)

Brand config lives in `lib/brands/registry.ts`. Logos are in `public/brands/`.

## Stripe checkout

1. Create a Stripe Checkout flow using `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint: `POST /api/stripe/webhook` for `checkout.session.completed`.
3. Set `STRIPE_WEBHOOK_SECRET` from the Stripe Dashboard.
4. In production, set `NEXT_PUBLIC_SITE_URL` so success/cancel redirects resolve correctly.

Local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Fulfilment workflow

```
Customer pays (Stripe) → order created
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

## Inventory & warehouse

- **Dashboard:** `/admin/inventory`
- **Products:** `/admin/inventory/products` — search, export CSV, stock ledger
- **Pricing:** `/admin/inventory/pricing`
- **Warehouses:** `/admin/inventory/warehouse`
- **Receive goods:** `/admin/inventory/receive`
- **Stock take:** `/admin/inventory/stock-take`
- **Warehouse ops:** `/admin/warehouse` — pick / pack / dispatch

Architecture docs: `../docs/vision/ARCHITECTURE.md` and `../docs/database/Schema.md`.

## Shopify setup

Preferred (Shopify Dev Dashboard apps, 2026+):

```
SHOPIFY_STORE=your-store-name
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
SHOPIFY_API_VERSION=2025-01
```

Legacy custom apps can still use `SHOPIFY_ADMIN_TOKEN=shpat_...`.

Required Admin API scopes: `read_draft_orders`, `write_draft_orders`.

### How Shopify sync works

- Each portal order is tagged in Shopify as `portal:CBC9001` (portal order number).
- Before creating a draft order, the system searches Shopify for this tag to prevent duplicates.
- After a successful push, `shopify_draft_order_id` and `fulfilment_status = ready` are saved in Supabase.

## Product weights

Shipping labels need parcel weight. Set `weight_grams` on products; order weight is `SUM(weight_grams × quantity)` → `orders.total_weight_grams`.

## Admin access

Staff sign in at `/admin/login` using Supabase Auth (email + password). Create users in **Supabase → Authentication → Users**.

Public API routes (no staff auth): `GET /api/catalog`, `POST /api/orders`, Stripe webhook/session. All other `/api/*` routes require authentication.

Tenant configuration: `tenants/chosen-by-chloe/`. Platform code: `lib/thomas/`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint |
| `npm run import:products` | Import products from spreadsheet |
| `npm run upload:images` | Upload product images to Supabase Storage |
| `npm run import:tonies-images` | Match & upload Tonies images from tonies.com |

Other one-off import/audit scripts live under `scripts/` (Tonies Blink24, Micro dropship, Mideer PI, pricing audit). Run with `npx tsx scripts/<name>.ts`.

### Adding product images

Name each image after the product SKU (e.g. `MID-001.jpg`), place them in `web/product-images/`, then:

```bash
npm run upload:images
```

## Project structure

```
web/
  app/
    page.tsx                     # Shop home
    brands/                      # Brand hub + /brands/[slug]
    checkout/                    # Checkout + Stripe success/cancel
    admin/                       # Orders, inventory, warehouse, purchasing
    api/
      catalog/                   # Public product catalog
      orders/                    # Create / list / fulfil orders
      stripe/                    # Checkout session + webhook
  components/
    brands/                      # BrandHero, BrandCatalog, BrandNav, …
    shop/                        # ShopHeader
    pdf/                         # Packing slip
  lib/
    brands/                      # Brand registry + catalog matching
    pricing.ts                   # Cost → sell price helpers
    stripe/                      # Checkout + payment completion
    shopify/                     # Auth, GraphQL, draft orders
    thomas/                      # Platform auth, tenant resolve
  public/brands/                 # Brand logos
  scripts/                       # Import, image, pricing utilities
  supabase/migrations/           # 0001–0012
```

## Manual testing checklist

### Stripe checkout

- [ ] Place a test order with Stripe test mode
- [ ] Confirm redirect to `/checkout/success`
- [ ] Confirm order appears in `/admin/orders` with payment recorded
- [ ] Cancel mid-checkout → `/checkout/cancel`

### Brands

- [ ] `/brands` lists active brands with logos
- [ ] `/brands/tonies` shows categories + search
- [ ] `/brands/micro-scooters` and `/brands/mideer` load catalogs

### Packing slip & Shopify

- [ ] Download packing slip PDF from order detail
- [ ] Push to Shopify → draft order created; second push does not duplicate
- [ ] Parcel weight displays when `weight_grams` is set

### Fulfilment dashboard

- [ ] `/admin/orders` shows order, packing slip, Shopify, weight, status
- [ ] Status shows **Ready** after Shopify sync
