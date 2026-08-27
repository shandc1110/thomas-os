-- Sprint 05C: Commercial assortment status (distinct from products.active and inventory).
-- NULL = not yet reviewed. Do NOT backfill existing rows in this migration.

alter table public.products
  add column if not exists assortment_status text;

comment on column public.products.assortment_status is
  'Chosen by Chloe selling assortment: active | paused | retired. NULL = not yet reviewed.';

alter table public.products
  drop constraint if exists products_assortment_status_check;

alter table public.products
  add constraint products_assortment_status_check
  check (
    assortment_status is null
    or assortment_status in ('active', 'paused', 'retired')
  );

-- Partial index: future storefront/admin filters on classified products only.
-- NULL (not yet reviewed) rows are excluded — intentional until business review (Sprint 05D+).
create index if not exists products_assortment_status_idx
  on public.products (assortment_status)
  where assortment_status is not null;
