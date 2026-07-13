-- Sprint 007: Warehouse Operations

alter table public.orders
  add column if not exists warehouse_status text not null default 'pending',
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists pick_started_at timestamptz,
  add column if not exists pick_completed_at timestamptz,
  add column if not exists pack_started_at timestamptz,
  add column if not exists pack_completed_at timestamptz;

create index if not exists orders_warehouse_status_idx
  on public.orders (warehouse_status);

-- Pick lists
create table if not exists public.warehouse_pick_lists (
  id uuid primary key default gen_random_uuid(),
  pick_list_number text not null unique,
  order_id bigint not null references public.orders(id) on delete cascade,
  status text not null default 'pending',
  picked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_pick_lines (
  id uuid primary key default gen_random_uuid(),
  pick_list_id uuid not null references public.warehouse_pick_lists(id) on delete cascade,
  order_item_id bigint,
  product_id bigint not null references public.products(id),
  location_id uuid references public.warehouse_locations(id),
  location_code text not null,
  sku text,
  product_name text not null,
  quantity_required integer not null,
  quantity_picked integer not null default 0,
  status text not null default 'pending',
  issue_type text,
  issue_notes text
);

create index if not exists warehouse_pick_lines_list_idx
  on public.warehouse_pick_lines (pick_list_id);

-- Packing sessions
create table if not exists public.warehouse_pack_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  status text not null default 'in_progress',
  packed_by text,
  packing_slip_printed boolean not null default false,
  label_printed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.warehouse_pack_verifications (
  id uuid primary key default gen_random_uuid(),
  pack_session_id uuid not null references public.warehouse_pack_sessions(id) on delete cascade,
  product_id bigint not null references public.products(id),
  sku text,
  expected_quantity integer not null,
  verified_quantity integer not null default 0,
  status text not null default 'pending',
  verified_at timestamptz
);

-- Activity log for KPIs
create table if not exists public.warehouse_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  order_id bigint references public.orders(id),
  user_name text default 'system',
  duration_seconds integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists warehouse_events_type_idx
  on public.warehouse_events (event_type, created_at desc);

-- Backfill existing orders
update public.orders
set warehouse_status = case
  when fulfilment_status = 'fulfilled' then 'shipped'
  when fulfilment_status = 'ready' then 'ready_to_ship'
  else 'pending'
end
where warehouse_status = 'pending';
