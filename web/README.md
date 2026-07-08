# Chosen by Chloe — Order Portal

A mobile-first ordering portal built with **Next.js 16**, **TypeScript**, **Tailwind CSS v4**, and **Supabase**.

Customers browse active products, add them to a cart, and check out. Orders are
written to Supabase with atomic stock reduction.

## Tech stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Storage)

## Prerequisites

- Node.js 20+ (LTS recommended)
- A Supabase project with `products`, `orders`, and `order_items` tables

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
   | `SUPABASE_SERVICE_ROLE_KEY` | **Secret** server key — required for placing orders and uploading images |

   Get the `service_role` key from Supabase → Project Settings → API.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Database notes

- The `orders` table optionally uses a `notes` column. To persist customer
  notes, run the migration in `supabase/migrations/0001_orders_notes.sql`
  (the API works without it and simply skips notes if the column is absent).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint |
| `npm run import:products` | Import products from `../CI+PL.xlsx` (needs `SUPABASE_SERVICE_ROLE_KEY`) |
| `npm run upload:images` | Upload product images to Supabase Storage and link them by SKU (needs `SUPABASE_SERVICE_ROLE_KEY`) |

### Adding product images

Name each image file after the product SKU (e.g. `MID-001.jpg`), place them in
`web/product-images/`, then run:

```bash
npm run upload:images
```

This creates a public `product-images` Storage bucket (if needed), uploads the
files, and sets each product's `image_url`.

## Project structure

```
web/
  app/
    page.tsx              # Homepage: product grid
    checkout/page.tsx     # Checkout form + order summary
    api/orders/route.ts   # Create order: validate stock, insert, decrement
  components/             # ProductCard, Catalog, StickyCart
  context/CartContext.tsx # Shopping cart (localStorage-backed)
  lib/                    # Supabase clients, types, helpers
  scripts/                # Import products / upload images
```
