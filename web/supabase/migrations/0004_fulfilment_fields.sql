-- Sprint 005: fulfilment automation fields

-- Product weight for shipping label calculation (grams)
alter table public.products
  add column if not exists weight_grams integer;

comment on column public.products.weight_grams is
  'Product weight in grams, used for parcel weight calculation.';

-- Order fulfilment tracking
alter table public.orders
  add column if not exists total_weight_grams integer,
  add column if not exists shopify_draft_order_id text,
  add column if not exists fulfilment_status text not null default 'pending';

comment on column public.orders.total_weight_grams is
  'Sum of (product weight_grams × quantity) for all line items.';
comment on column public.orders.shopify_draft_order_id is
  'Shopify Draft Order GID after successful sync.';
comment on column public.orders.fulfilment_status is
  'Fulfilment workflow status: pending, ready, fulfilled.';

create index if not exists orders_fulfilment_status_idx
  on public.orders (fulfilment_status);

create index if not exists orders_shopify_draft_order_id_idx
  on public.orders (shopify_draft_order_id)
  where shopify_draft_order_id is not null;
