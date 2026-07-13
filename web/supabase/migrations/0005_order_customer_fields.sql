-- Structured customer fields for checkout and fulfilment

alter table public.orders
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists postcode text;

comment on column public.orders.first_name is 'Customer first name';
comment on column public.orders.last_name is 'Customer last name';
comment on column public.orders.postcode is 'Delivery postcode';
