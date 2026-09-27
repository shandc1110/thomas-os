-- Track when an order's packing slip was last downloaded/printed (single or combined).

alter table public.orders
  add column if not exists packing_slip_printed_at timestamptz;

comment on column public.orders.packing_slip_printed_at is
  'Last time a packing slip (single or combined) was generated for this order. Null = not printed.';
