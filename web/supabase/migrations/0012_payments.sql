-- Sprint: online payments (Stripe Checkout)

alter table public.orders
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists stripe_checkout_session_id text null,
  add column if not exists stripe_payment_intent_id text null,
  add column if not exists paid_at timestamptz null;

comment on column public.orders.payment_status is
  'unpaid | pending (Stripe checkout started) | paid | refunded';
comment on column public.orders.stripe_checkout_session_id is
  'Stripe Checkout Session id when customer pays by card.';
comment on column public.orders.stripe_payment_intent_id is
  'Stripe PaymentIntent id after successful card payment.';
comment on column public.orders.paid_at is
  'When payment was confirmed (Stripe webhook or manual).';

create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_stripe_checkout_session_id_idx
  on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
