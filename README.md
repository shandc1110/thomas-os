# Thomas OS

**Thomas** is a retail operating system. **Chosen by Chloe** is the first tenant.

The application lives in [`web/`](./web/). See **[web/README.md](./web/README.md)** for setup, environment variables, migrations, and workflows.

## Quick start

```bash
git clone https://github.com/shandc1110/thomas-os.git
cd thomas-os/web
npm install
cp .env.example .env.local   # fill in secrets
npm run dev
```

- Shop: http://localhost:3000  
- Brands: http://localhost:3000/brands  
- Admin: http://localhost:3000/admin  

Production: https://chosen-by-chloe-order-portal.vercel.app

## What’s in this repo

| Area | Description |
|------|-------------|
| Storefront | Multi-brand shop (Mideer, Tonies, Micro Scooters), cart, Stripe checkout |
| Pre-order | Sell in-transit stock before warehouse arrival |
| Admin | Orders, inventory, warehouse pick/pack/dispatch, purchasing |
| Integrations | Supabase, Stripe, Shopify draft orders, Resend email |

Deploy from the repo root with Vercel (`vercel.json` builds the `web/` Next.js app).
