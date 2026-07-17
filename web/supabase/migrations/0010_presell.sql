-- Sprint 010: Pre-sell — sell stock in transit before it arrives in warehouse

alter table public.products
  add column if not exists presell_enabled boolean not null default false,
  add column if not exists presell_quantity integer not null default 0,
  add column if not exists expected_arrival_month text null;

comment on column public.products.presell_enabled is
  'When true, presell_quantity units may be sold before on-hand stock is available.';
comment on column public.products.presell_quantity is
  'Units in transit / on order available for pre-sell (decremented on customer order).';
comment on column public.products.expected_arrival_month is
  'Expected warehouse arrival month shown to customers, e.g. 2026-08 for August 2026.';

alter table public.order_items
  add column if not exists presell_quantity integer not null default 0;

comment on column public.order_items.presell_quantity is
  'Units from this line fulfilled from pre-sell (in transit) rather than on-hand stock.';
