-- Version 1 ordering: add the optional customer notes column to orders.
-- The API route works without this (it gracefully skips notes), but running
-- this migration lets customer notes be persisted.

alter table public.orders
  add column if not exists notes text;
