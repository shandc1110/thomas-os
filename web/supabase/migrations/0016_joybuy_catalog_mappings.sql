-- Joybuy first-product merchant catalog mappings + product mapping extensions.
-- Do NOT seed example Joybuy documentation IDs (brandId/categoryId/scene/shopId).
-- Merchant values are upserted at runtime from configured env / admin once known.

-- Persist Joybuy versionId and channel-only metadata (e.g. list price override) on product maps.
alter table public.channel_product_mappings
  add column if not exists external_version_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.channel_product_mappings.external_version_id is
  'Joybuy product versionId returned by product-schema (when present).';

comment on column public.channel_product_mappings.metadata is
  'Channel-only metadata (never AppSecret/tokens). May include listPrice override, scene snapshot.';

-- Brand / category / shop / scene entity mappings for marketplace channels.
create table if not exists public.channel_catalog_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel text not null,
  entity_type text not null
    check (entity_type in ('brand', 'category', 'shop', 'scene')),
  -- Internal key: brand name ("Mideer"), product SKU for category ("CT7013"), or "default" for shop/scene.
  internal_key text not null,
  external_id text not null,
  label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, entity_type, internal_key)
);

comment on table public.channel_catalog_mappings is
  'Maps Thomas brand/category/shop/scene keys to Joybuy external IDs. Never store secrets.';

create index if not exists channel_catalog_mappings_org_channel_idx
  on public.channel_catalog_mappings (organization_id, channel);
