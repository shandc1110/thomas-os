-- Sprint 011: Separate Shopify price from console (order portal) price

alter table public.products
  add column if not exists shopify_price numeric(12,2);

comment on column public.products.shopify_price is
  'Shopify storefront price (CNY). Independent of console price (products.price).';

comment on column public.products.price is
  'Console / order-portal shop price (CNY). Do not overwrite from Shopify pricing tools.';
