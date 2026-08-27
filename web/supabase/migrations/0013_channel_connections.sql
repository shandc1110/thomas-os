-- Channel connections + Joybuy product ID mapping (no secrets in metadata).
-- Apply manually after review. Do not store AppSecret or access tokens here.

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel text not null,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'pending', 'connected', 'error')),
  external_account_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)
);

comment on table public.channel_connections is
  'Sales-channel connection state. Never store AppSecret or access tokens in metadata.';

create index if not exists channel_connections_org_idx
  on public.channel_connections (organization_id);

-- Idempotent SKU / product mapping for marketplace channels (e.g. Joybuy).
create table if not exists public.channel_product_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  channel text not null,
  -- Stored as text to match Thomas product ids (uuid or numeric, depending on env).
  internal_product_id text not null,
  sku text not null,
  external_product_id text,
  external_sku_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, sku)
);

comment on table public.channel_product_mappings is
  'Maps Thomas products to external channel product/SKU IDs for idempotent sync.';

create index if not exists channel_product_mappings_org_channel_idx
  on public.channel_product_mappings (organization_id, channel);

create index if not exists channel_product_mappings_external_idx
  on public.channel_product_mappings (channel, external_product_id);

-- Seed Joybuy as pending for Chosen by Chloe (first tenant). Not connected.
insert into public.channel_connections (
  organization_id,
  channel,
  status,
  metadata
)
values (
  '00000000-0000-0000-0000-000000000001',
  'joybuy',
  'pending',
  jsonb_build_object(
    'app_name', 'Thomas OS',
    'business_type', 'ISV Applications',
    'app_type', 'ERP Management',
    'review_status', 'pending_review'
  )
)
on conflict (organization_id, channel) do nothing;
