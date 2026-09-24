-- Chloe's Edit — explicit editorial curation (not assortment, tags, or channels).
-- Organization scoping is enforced in application code (same pattern as 0016);
-- this project does not define table RLS policies in migrations.

create table if not exists public.chloe_edit_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 10,
  editorial_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id)
);

comment on table public.chloe_edit_products is
  'Human-curated Chloe''s Edit membership. Independent of assortment, price, and channels.';

comment on column public.chloe_edit_products.position is
  'Explicit merchandising order (ASC). Prefer gaps (10, 20, 30) for easy reordering.';

comment on column public.chloe_edit_products.editorial_note is
  'Optional staff-written note. Never auto-generated. Null when unused.';

create index if not exists chloe_edit_products_org_position_idx
  on public.chloe_edit_products (organization_id, position asc, product_id asc);

create index if not exists chloe_edit_products_product_idx
  on public.chloe_edit_products (product_id);
