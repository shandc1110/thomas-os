-- Sprint 10: Channel commercial prices (Community / Shopify GBP / Joybuy GBP)
-- Does NOT overwrite products.price. No FX. No inferred retail.

alter table public.products
  add column if not exists joybuy_price numeric(12,2);

comment on column public.products.price is
  'Community / console source selling price. For Mideer this remains CNY. Never overwrite for UK channels.';

comment on column public.products.shopify_price is
  'Explicit Chosen by Chloe UK / Shopify channel price in GBP. Not FX of products.price. Null = missing UK Shopify price.';

comment on column public.products.joybuy_price is
  'Explicit Joybuy UK channel list price in GBP. Independent of shopify_price. Null = missing Joybuy GBP price.';
