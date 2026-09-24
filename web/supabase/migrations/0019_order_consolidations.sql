-- Sprint 12: Order consolidations + customer invoices (operational layer above orders).
-- Original orders remain immutable. Organization scoping is enforced in application code
-- (same pattern as 0016/0018); this project does not define table RLS policies in migrations.

-- ─── Consolidations ──────────────────────────────────────────────────────────

create table if not exists public.order_consolidations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  consolidation_number text not null,
  currency text not null,
  customer_name text not null,
  customer_email text not null,
  delivery_address_snapshot text not null,
  postcode_snapshot text,
  match_key text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'invoiced', 'fulfilled', 'cancelled')),
  delivery_review_required boolean not null default false,
  merchandise_total numeric(12, 2) not null default 0,
  delivery_total numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  vat_total numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  invoice_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, consolidation_number)
);

comment on table public.order_consolidations is
  'Operational grouping of compatible customer orders for one shipment/invoice. Does not mutate orders.';

comment on column public.order_consolidations.match_key is
  'Deterministic normalized name|email|address|postcode|currency key.';

comment on column public.order_consolidations.delivery_review_required is
  'True when multiple orders are grouped and no authoritative delivery fee exists on orders.';

create index if not exists order_consolidations_org_status_idx
  on public.order_consolidations (organization_id, status, created_at desc);

create index if not exists order_consolidations_org_match_key_idx
  on public.order_consolidations (organization_id, match_key);

create table if not exists public.order_consolidation_orders (
  id uuid primary key default gen_random_uuid(),
  consolidation_id uuid not null
    references public.order_consolidations (id) on delete cascade,
  order_id uuid not null references public.orders (id),
  created_at timestamptz not null default now(),
  unique (consolidation_id, order_id)
);

comment on table public.order_consolidation_orders is
  'Membership of original orders in a consolidation. Orders remain independently queryable.';

create index if not exists order_consolidation_orders_order_idx
  on public.order_consolidation_orders (order_id);

create index if not exists order_consolidation_orders_consolidation_idx
  on public.order_consolidation_orders (consolidation_id);

-- An order may belong to at most one non-cancelled consolidation.
create unique index if not exists order_consolidation_orders_active_order_uidx
  on public.order_consolidation_orders (order_id)
  where consolidation_id in (
    select id from public.order_consolidations where status <> 'cancelled'
  );

-- Postgres cannot use a subquery in a partial unique index predicate on all versions.
-- Use a simpler partial unique index: enforce uniqueness of order_id across ALL memberships,
-- and require staff to remove/cancel before re-grouping. Drop the subquery index if created.
drop index if exists public.order_consolidation_orders_active_order_uidx;

create unique index if not exists order_consolidation_orders_order_unique_uidx
  on public.order_consolidation_orders (order_id);

-- ─── Invoices ────────────────────────────────────────────────────────────────

create table if not exists public.order_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  consolidation_id uuid not null
    references public.order_consolidations (id) on delete restrict,
  invoice_number text not null,
  invoice_date date not null default (timezone('utc', now()))::date,
  currency text not null,
  payment_status_label text not null
    check (payment_status_label in ('PAID', 'DUE')),
  merchandise_total numeric(12, 2) not null default 0,
  delivery_total numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  vat_total numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  order_numbers text[] not null default '{}',
  pdf_storage_path text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number),
  unique (consolidation_id)
);

comment on table public.order_invoices is
  'Customer invoice generated from a consolidation. One active invoice per consolidation (idempotent).';

comment on column public.order_invoices.payload is
  'Full line-item snapshot (order_id, sku, qty, unit price from order_items) for audit.';

comment on column public.order_invoices.pdf_storage_path is
  'Path in the private Supabase Storage invoices bucket.';

create index if not exists order_invoices_org_created_idx
  on public.order_invoices (organization_id, created_at desc);

-- Back-reference from consolidation → invoice once generated
alter table public.order_consolidations
  drop constraint if exists order_consolidations_invoice_id_fkey;

alter table public.order_consolidations
  add constraint order_consolidations_invoice_id_fkey
  foreign key (invoice_id) references public.order_invoices (id)
  on delete set null;
