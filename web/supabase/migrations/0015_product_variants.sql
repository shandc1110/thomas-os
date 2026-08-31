-- Product variant grouping for storefront size/colour selection (one PDP, many SKUs).

alter table public.products
  add column if not exists variant_group_key text,
  add column if not exists is_listing_product boolean not null default true,
  add column if not exists variant_option1 text,
  add column if not exists variant_option2 text,
  add column if not exists variant_count integer not null default 1;

comment on column public.products.variant_group_key is
  'Groups sellable SKU rows under one storefront listing (e.g. Shopify product handle).';

comment on column public.products.is_listing_product is
  'When false, row is a variant SKU hidden from catalogue grids; parent listing row is true.';

comment on column public.products.variant_count is
  'Number of sellable variants in the group (on listing row only).';

create index if not exists products_variant_group_key_idx
  on public.products (variant_group_key)
  where variant_group_key is not null;

create index if not exists products_listing_product_idx
  on public.products (is_listing_product)
  where is_listing_product = true;
