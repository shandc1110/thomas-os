-- Sprint 006: Inventory & Warehouse Management
-- Product Master extensions, warehouses, ledger-based inventory

-- ─── Product Master extensions ───────────────────────────────────────────────

alter table public.products
  add column if not exists barcode text,
  add column if not exists length_mm integer,
  add column if not exists width_mm integer,
  add column if not exists height_mm integer,
  add column if not exists country_of_origin text,
  add column if not exists hs_code text,
  add column if not exists cost_price numeric(12,2),
  add column if not exists wholesale_price numeric(12,2),
  add column if not exists retail_price numeric(12,2),
  add column if not exists currency text default 'CNY',
  add column if not exists status text default 'active',
  add column if not exists gallery_images jsonb default '[]'::jsonb,
  add column if not exists tags text[] default '{}',
  add column if not exists low_stock_threshold integer default 5,
  add column if not exists updated_at timestamptz default now();

-- Backfill retail_price from existing price column
update public.products
set retail_price = price
where retail_price is null and price is not null;

create unique index if not exists products_sku_key
  on public.products (sku)
  where sku is not null;

create index if not exists products_barcode_idx
  on public.products (barcode)
  where barcode is not null;

create index if not exists products_status_idx
  on public.products (status);

-- ─── Warehouses ──────────────────────────────────────────────────────────────

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_locations (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (warehouse_id, code)
);

create index if not exists warehouse_locations_warehouse_idx
  on public.warehouse_locations (warehouse_id);

-- ─── Inventory balances (updated only via stock movements) ─────────────────

create table if not exists public.inventory_balances (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  location_id uuid not null references public.warehouse_locations(id) on delete cascade,
  available integer not null default 0,
  allocated integer not null default 0,
  reserved integer not null default 0,
  incoming integer not null default 0,
  damaged integer not null default 0,
  returned integer not null default 0,
  on_order integer not null default 0,
  last_updated timestamptz not null default now(),
  unique (product_id, location_id)
);

create index if not exists inventory_balances_product_idx
  on public.inventory_balances (product_id);

create index if not exists inventory_balances_warehouse_idx
  on public.inventory_balances (warehouse_id);

-- ─── Stock movement ledger (immutable) ───────────────────────────────────────

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_number text not null unique,
  movement_type text not null,
  product_id bigint not null references public.products(id),
  sku text,
  quantity integer not null,
  warehouse_id uuid references public.warehouses(id),
  location_id uuid references public.warehouse_locations(id),
  reference_type text,
  reference_id text,
  reason text,
  notes text,
  user_name text default 'system',
  balance_after integer,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, created_at desc);

create index if not exists stock_movements_type_idx
  on public.stock_movements (movement_type);

create index if not exists stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id);

-- ─── Goods receipts ──────────────────────────────────────────────────────────

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  po_reference text,
  warehouse_id uuid not null references public.warehouses(id),
  location_id uuid not null references public.warehouse_locations(id),
  status text not null default 'completed',
  notes text,
  received_by text default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.goods_receipt_lines (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  product_id bigint not null references public.products(id),
  quantity_expected integer not null default 0,
  quantity_received integer not null default 0
);

-- ─── Stock take sessions ─────────────────────────────────────────────────────

create table if not exists public.stock_take_sessions (
  id uuid primary key default gen_random_uuid(),
  session_number text not null unique,
  warehouse_id uuid not null references public.warehouses(id),
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  started_by text default 'system'
);

create table if not exists public.stock_take_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.stock_take_sessions(id) on delete cascade,
  product_id bigint not null references public.products(id),
  location_id uuid not null references public.warehouse_locations(id),
  system_quantity integer not null default 0,
  counted_quantity integer,
  variance integer,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Inventory alerts ────────────────────────────────────────────────────────

create table if not exists public.inventory_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  product_id bigint references public.products(id) on delete cascade,
  message text not null,
  severity text not null default 'warning',
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists inventory_alerts_unacked_idx
  on public.inventory_alerts (acknowledged, created_at desc)
  where acknowledged = false;

-- ─── Seed default warehouses ─────────────────────────────────────────────────

insert into public.warehouses (code, name, address, is_default)
values
  ('LON-GAR', 'London Garage', 'London, UK', true),
  ('MAIN', 'Main Warehouse', 'China', false)
on conflict (code) do nothing;

insert into public.warehouse_locations (warehouse_id, code, name)
select w.id, loc.code, loc.name
from public.warehouses w
cross join (values ('A01', 'Shelf A01'), ('A02', 'Shelf A02'), ('A03', 'Shelf A03')) as loc(code, name)
where w.code = 'LON-GAR'
on conflict (warehouse_id, code) do nothing;

insert into public.warehouse_locations (warehouse_id, code, name)
select w.id, loc.code, loc.name
from public.warehouses w
cross join (values ('R01', 'Rack R01'), ('R02', 'Rack R02'), ('R03', 'Rack R03')) as loc(code, name)
where w.code = 'MAIN'
on conflict (warehouse_id, code) do nothing;

-- ─── Migrate existing stock into ledger (opening balance) ────────────────────
-- Creates opening-balance movements for products with stock > 0 at default location.

do $$
declare
  default_wh uuid;
  default_loc uuid;
  prod record;
  mov_num text;
begin
  select w.id into default_wh from public.warehouses w where w.is_default = true limit 1;
  if default_wh is null then return; end if;

  select l.id into default_loc
  from public.warehouse_locations l
  where l.warehouse_id = default_wh
  order by l.code
  limit 1;

  if default_loc is null then return; end if;

  for prod in
    select p.id, p.sku, p.stock
    from public.products p
    where coalesce(p.stock, 0) > 0
      and not exists (
        select 1 from public.stock_movements sm
        where sm.product_id = p.id and sm.movement_type = 'opening_balance'
      )
  loop
    mov_num := 'MOV-OB-' || prod.id;

    insert into public.stock_movements (
      movement_number, movement_type, product_id, sku, quantity,
      warehouse_id, location_id, reference_type, reason, balance_after
    ) values (
      mov_num, 'opening_balance', prod.id, prod.sku, prod.stock,
      default_wh, default_loc, 'migration', 'Sprint 006 opening balance migration', prod.stock
    );

    insert into public.inventory_balances (
      product_id, warehouse_id, location_id, available, last_updated
    ) values (
      prod.id, default_wh, default_loc, prod.stock, now()
    )
    on conflict (product_id, location_id)
    do update set available = prod.stock, last_updated = now();
  end loop;
end $$;
