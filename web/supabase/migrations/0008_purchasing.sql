-- Sprint 008: Purchasing & Supplier Management

-- Suppliers
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  currency text default 'CNY',
  contact_name text,
  email text,
  phone text,
  address text,
  payment_terms text,
  lead_time_days integer,
  incoterms text,
  bank_details text,
  tax_number text,
  preferred_freight text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Brands
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country text,
  supplier_id uuid references public.suppliers(id),
  website text,
  logo_url text,
  contract_status text default 'active',
  exclusive_distributor boolean default false,
  minimum_order_value numeric(12,2),
  lead_time_days integer,
  created_at timestamptz not null default now()
);

-- Link products to brands table (optional FK)
alter table public.products
  add column if not exists brand_id uuid references public.brands(id),
  add column if not exists factory_cost numeric(12,2),
  add column if not exists shipping_cost numeric(12,2),
  add column if not exists duty_cost numeric(12,2),
  add column if not exists vat_cost numeric(12,2),
  add column if not exists import_fees numeric(12,2),
  add column if not exists handling_cost numeric(12,2),
  add column if not exists landed_cost numeric(12,2);

-- Purchase Orders
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft',
  currency text default 'CNY',
  issue_date date,
  expected_ship_date date,
  expected_arrival date,
  expected_payment date,
  incoterms text,
  freight_method text,
  container_number text,
  tracking_number text,
  subtotal numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  shipping_cost numeric(12,2) default 0,
  import_costs numeric(12,2) default 0,
  duty numeric(12,2) default 0,
  vat numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id bigint references public.products(id),
  sku text,
  product_name text not null,
  quantity integer not null,
  quantity_received integer not null default 0,
  unit_cost numeric(12,2) not null,
  discount numeric(12,2) default 0,
  line_total numeric(12,2) not null
);

-- Shipments (inbound)
create table if not exists public.inbound_shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text not null unique,
  purchase_order_id uuid references public.purchase_orders(id),
  supplier_id uuid references public.suppliers(id),
  freight_method text,
  forwarder text,
  container_number text,
  tracking_number text,
  departure_date date,
  arrival_date date,
  eta date,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

-- Supplier documents
create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete cascade,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  doc_type text not null,
  file_name text not null,
  file_url text not null,
  uploaded_at timestamptz not null default now()
);

-- Link goods receipts to purchase orders
alter table public.goods_receipts
  add column if not exists purchase_order_id uuid references public.purchase_orders(id);

create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index if not exists purchase_orders_status_idx on public.purchase_orders (status);
create index if not exists inbound_shipments_po_idx on public.inbound_shipments (purchase_order_id);

-- Supplier performance snapshots (computed on read; table for caching later)
create table if not exists public.supplier_performance (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  period_month date not null,
  total_spend numeric(12,2) default 0,
  orders_count integer default 0,
  on_time_pct numeric(5,2),
  late_deliveries integer default 0,
  quality_issues integer default 0,
  unique (supplier_id, period_month)
);
